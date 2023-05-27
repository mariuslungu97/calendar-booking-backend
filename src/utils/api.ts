import dayjs from "dayjs";
import logger from "../loaders/logger";
import knexClient from "../loaders/knex";

import {
  getAvailableTimeSlots,
  isTimeSlotAvailable,
  getMonthStartEnd,
  getDateStartEnd,
  dayTimeToDate,
  dateInTimezone,
  dateToTimezone,
} from "./schedule";

import {
  TTimeSlotString,
  ScheduleWithPeriods,
  EventType,
  AvailableDates,
  AvailableDate,
  AvailableTimeSlot,
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
    const dateConvertStart = dateToTimezone(
      dayTimeToDate(period.day, period.start_time, tz),
      newTz
    );
    const dateConvertEnd = dateToTimezone(
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
): Promise<AvailableDates | null> => {
  try {
    const monthSlots: AvailableDates = { month, timezone, dates: [] };

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

    const visitorCurrentDate = dateToTimezone(dayjs(), timezone);

    // grab all calendar events within given month in UTC
    const [monthStart, monthEnd] = getMonthStartEnd(month);
    const monthStartUtc = dateToTimezone(
      dateInTimezone(monthStart, timezone),
      "Etc/UTC"
    );
    const monthEndUtc = dateToTimezone(
      dateInTimezone(monthEnd, timezone),
      "Etc/UTC"
    );

    // avoid retrieving events in the past
    const eventsStartDate =
      visitorCurrentDate.month() === monthStart.month()
        ? dateToTimezone(visitorCurrentDate, "Etc/UTC")
        : monthStartUtc;

    const calendarEvents = await knexClient("calendar_events")
      .select("*")
      .leftJoin(
        "event_schedules",
        "calendar_events.schedule_id",
        "event_schedules.id"
      )
      .where("event_schedules.end_date_time", ">", eventsStartDate.unix())
      .where("event_schedules.end_date_time", "<", monthEndUtc.unix());

    // convert calendar events to visitor's timezone
    const tzCalendarEvents = calendarEvents.map((event) => ({
      ...event,
      start_date_time: dateToTimezone(event.start_date_time, timezone),
      end_date_time: dateToTimezone(event.end_date_time, timezone),
    }));

    // compute available events for each day of the month
    const daysInMonth = monthStart.daysInMonth();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateInMonth = monthStart.clone().date(day);
      const dateSlots: AvailableDate = {
        date: dateInMonth.format("DD-MM-YYYY"),
        times: [],
      };

      // skip previous days if we're attempting to retrieve slots in current month
      if (
        visitorCurrentDate.month() === monthStart.month() &&
        day < visitorCurrentDate.date()
      ) {
        monthSlots.dates.push(dateSlots);
        continue;
      }

      let schedule = tzPeriods
        .filter((tzPeriod) => tzPeriod.day === dateInMonth.day())
        .map((tzPeriod) => [
          tzPeriod.start_time.date(dateInMonth.date()),
          tzPeriod.end_time.date(dateInMonth.date()),
        ]) as TDayjsSlot[];

      // skip previous schedules if we're attempting to retrieve slots in same day
      if (
        visitorCurrentDate.month() === monthStart.month() &&
        day === visitorCurrentDate.date()
      ) {
        schedule = schedule.filter((tzPeriod) =>
          tzPeriod[0].isSameOrAfter(visitorCurrentDate)
        );
      }

      if (!schedule.length) {
        monthSlots.dates.push(dateSlots);
        continue;
      }

      const [startDate, endDate] = getDateStartEnd(
        dateInMonth.format("DD-MM-YYYY"),
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

      dateSlots.times.push(
        ...(availableSlots.map((avSlot) => ({
          startTime: avSlot.from.format("HH:mm"),
          endTime: avSlot.to.format("HH:mm"),
        })) as AvailableTimeSlot[])
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

    const dateStart = dateInTimezone(dayjs(timeSlot[0]), timezone);
    const dateEnd = dateInTimezone(dayjs(timeSlot[1]), timezone);
    const dateStartUtc = dateToTimezone(dateStart, "Etc/UTC");
    const dateEndUtc = dateToTimezone(dateEnd, "Etc/UTC");

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
        dateInTimezone(tzPeriod.start_time, timezone).day(tzPeriod.day),
        dateInTimezone(tzPeriod.end_time, timezone).day(tzPeriod.day),
      ]) as TDayjsSlot[];

    const bookedSlots = calendarEvents.map((event) => [
      dateToTimezone(event.start_date_time, timezone),
      dateToTimezone(event.end_date_time, timezone),
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
