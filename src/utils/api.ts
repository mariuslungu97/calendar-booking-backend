import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import logger from "../loaders/logger";
import knexClient from "../loaders/knex";

dayjs.extend(utc);
dayjs.extend(timezone);

import {
  getAvailableTimeSlots,
  isTimeSlotAvailable,
  getMonthStartEnd,
  getDateStartEnd,
  dayTimeToDate,
  tzSwap,
} from "./schedule";

import {
  TTimeSlotString,
  ScheduleWithPeriods,
  EventType,
  MonthSlots,
  DateSlots,
  SchedulePeriod,
  ReducedPeriod,
  TDayjsSlot,
} from "../types";

const convertSchedulePeriodsToTz = (
  periods: SchedulePeriod[],
  tz: string,
  newTz: string
): ReducedPeriod[] => {
  const newPeriods: ReducedPeriod[] = [];

  for (const period of periods) {
    const dateConvertStart = tzSwap(
      dayTimeToDate(period.day, period.start_time, tz),
      newTz
    );
    const dateConvertEnd = tzSwap(
      dayTimeToDate(period.day, period.end_time, tz),
      newTz
    );

    if (dateConvertStart.day() !== dateConvertEnd.day()) {
      // split the schedule periods into two halves: [start, 23:59] and [00:00, end]
      newPeriods.push({
        day: dateConvertStart.day(),
        start_time: dateConvertStart.clone(),
        end_time: dayjs().hour(23).minute(59),
      });

      newPeriods.push({
        day: dateConvertEnd.day(),
        start_time: dayjs().hour(0).minute(0),
        end_time: dateConvertEnd.clone(),
      });
    } else {
      newPeriods.push({
        day: dateConvertStart.day(),
        start_time: dateConvertStart.clone(),
        end_time: dateConvertEnd.clone(),
      });
    }
  }

  return newPeriods;
};

const retrieveUserScheduleWithPeriods = async (
  scheduleId: string
): Promise<ScheduleWithPeriods | null> => {
  try {
    const scheduleList = await knexClient("schedules")
      .select("*")
      .where({ id: scheduleId });
    if (scheduleList.length === 0)
      throw new Error("No schedule with provided id!");

    const schedule = scheduleList[0];

    const schedulePeriodsList = await knexClient("schedule_periods")
      .select("*")
      .where({ schedule_id: schedule.id })
      .orderBy([{ column: "day" }, { column: "start_time" }]);

    const scheduleWithPeriods: ScheduleWithPeriods = {
      schedule,
      periods: schedulePeriodsList,
    };
    return scheduleWithPeriods;
  } catch (err) {
    logger.error(
      "Unexpected error trying to retrieve user schedule with periods!",
      err
    );
    return null;
  }
};

const retrieveMonthSlots = async (
  eventType: EventType,
  month: string,
  timezone: string
): Promise<MonthSlots | null> => {
  try {
    const monthSlots: MonthSlots = { month, timezone, dates: [] };

    const scheduleWithPeriods = await retrieveUserScheduleWithPeriods(
      eventType.schedule_id
    );
    if (!scheduleWithPeriods)
      throw new Error(
        "Couldn't find the associated schedule with an event type!"
      );

    // convert schedule periods to visitor's timezone
    const tzPeriods = convertSchedulePeriodsToTz(
      scheduleWithPeriods.periods,
      scheduleWithPeriods.schedule.timezone,
      timezone
    );

    // grab all calendar events within given month in UTC
    const [monthStart, monthEnd] = getMonthStartEnd(month);
    const monthStartUtc = dayjs.tz(monthStart, timezone).tz("Etc/UTC");
    const monthEndUtc = dayjs.tz(monthEnd, timezone).tz("Etc/UTC");

    const calendarEvents = await knexClient("calendar_events")
      .select("*")
      .leftJoin(
        "event_schedules",
        "calendar_events.schedule_id",
        "event_schedules.id"
      )
      .where("event_schedules.end_date_time", ">", monthStartUtc.unix())
      .where("event_schedules.end_date_time", "<", monthEndUtc.unix());

    // convert calendar events to visitor's timezone
    const tzCalendarEvents = calendarEvents.map((event) => ({
      ...event,
      start_date_time: dayjs(event.start_date_time).tz(timezone),
      end_date_time: dayjs(event.end_date_time).tz(timezone),
    }));

    // compute available events for each day of the month
    const daysInMonth = monthStart.daysInMonth();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = monthStart.clone().date(day);
      const dateSlots: DateSlots = {
        date: date.format("DD-MM-YYYY"),
        slots: [],
      };

      const schedule = tzPeriods
        .filter((tzPeriod) => tzPeriod.day === date.day())
        .map((tzPeriod) => [
          tzPeriod.start_time.date(date.date()),
          tzPeriod.end_time.date(date.date()),
        ]) as TDayjsSlot[];

      if (!schedule.length) {
        monthSlots.dates.push(dateSlots);
        continue;
      }

      const [startDate, endDate] = getDateStartEnd(
        date.format("DD-MM-YYYY"),
        timezone
      );
      const bookedSlots = tzCalendarEvents
        .filter(
          (tzEvent) =>
            tzEvent.end_date_time.isSameOrAfter(startDate, "minute") &&
            tzEvent.end_date_time.isSameOrBefore(endDate, "minute")
        )
        .map((tzEvent) => [
          tzEvent.start_date_time,
          tzEvent.end_date_time,
        ]) as TDayjsSlot[];

      const availableSlots = getAvailableTimeSlots(
        schedule,
        bookedSlots,
        eventType.duration
      );

      dateSlots.slots.push(
        ...(availableSlots.map((avSlot) =>
          avSlot.toString()
        ) as TTimeSlotString[])
      );
      monthSlots.dates.push(dateSlots);
    }

    return monthSlots;
  } catch (err) {
    logger.error(
      "Unexpected error trying to retrieve available date times by month!",
      err
    );
    return null;
  }
};

const isSlotValid = async (
  eventType: EventType,
  timeSlot: TTimeSlotString,
  timezone: string
): Promise<boolean> => {
  try {
    const scheduleWithPeriods = await retrieveUserScheduleWithPeriods(
      eventType.schedule_id
    );

    if (!scheduleWithPeriods)
      throw new Error(
        "Couldn't find the associated schedule with an event type!"
      );

    // convert schedule periods to visitor's timezone
    const tzPeriods = convertSchedulePeriodsToTz(
      scheduleWithPeriods.periods,
      scheduleWithPeriods.schedule.timezone,
      timezone
    );

    const dateStart = dayjs.tz(timeSlot[0], timezone);
    const dateEnd = dayjs.tz(timeSlot[1], timezone);
    const dateStartUtc = tzSwap(dateStart, "Etc/UTC");
    const dateEndUtc = tzSwap(dateEnd, "Etc/UTC");

    const calendarEvents = await knexClient("calendar_events")
      .select("*")
      .leftJoin(
        "event_schedules",
        "calendar_events.schedule_id",
        "event_schedules.id"
      )
      .where("event_schedules.end_date_time", ">", dateStartUtc.unix())
      .where("event_schedules.end_date_time", "<", dateEndUtc.unix());

    const schedule = tzPeriods
      .filter(
        (tzPeriod) =>
          tzPeriod.day === dateStart.day() || tzPeriod.day === dateEnd.day()
      )
      .map((tzPeriod) => [
        dayjs.tz(tzPeriod.start_time, timezone).day(tzPeriod.day),
        dayjs.tz(tzPeriod.end_time, timezone).day(tzPeriod.day),
      ]) as TDayjsSlot[];

    const bookedSlots = calendarEvents.map((event) => [
      dayjs(event.start_date_time).tz(timezone),
      dayjs(event.end_date_time).tz(timezone),
    ]) as TDayjsSlot[];

    const isAvailable = isTimeSlotAvailable(schedule, bookedSlots, [
      dateStart,
      dateEnd,
    ]);

    return isAvailable;
  } catch (err) {
    logger.error(
      "Unexpected error trying to retrieve available date times by month!",
      err
    );
    return false;
  }
};

export { retrieveMonthSlots, isSlotValid };
