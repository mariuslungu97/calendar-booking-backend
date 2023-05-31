import dayjs from "dayjs";
import logger from "../loaders/logger";
import knexClient from "../loaders/knex";

import { GraphQLError } from "graphql";
import { ValidationError } from "joi";

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

const convertScheduleTimezone = (
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
        end_time: dateInTimezone(dayjs(), newTz).hour(23).minute(59),
      });

      newPeriods.push({
        day: dateConvertEnd.day(),
        start_time: dateInTimezone(dayjs(), newTz).hour(0).minute(0),
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
): Promise<ScheduleWithPeriods> => {
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
      "Unexpected error trying to retrieve user schedule with periods!"
    );
    throw err;
  }
};

const retrieveAvailableDates = async (
  eventType: EventType,
  month: string,
  timezone: string
): Promise<AvailableDates> => {
  try {
    const monthSlots: AvailableDates = { month, timezone, dates: [] };

    const scheduleWithPeriods = await retrieveUserScheduleWithPeriods(
      eventType.schedule_id
    );

    // convert schedule periods to visitor's timezone
    const tzPeriods = convertScheduleTimezone(
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

    const eventsEndDate = monthEndUtc.add(1, "day");

    const calendarEvents = await knexClient("calendar_events")
      .select("*")
      .leftJoin(
        "event_schedules",
        "calendar_events.schedule_id",
        "event_schedules.id"
      )
      .where("event_schedules.end_date_time", ">", eventsStartDate.unix())
      .where("event_schedules.end_date_time", "<", eventsEndDate.unix());

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
        dateInMonth.format("DD-MM-YYYY")
      );
      const startDateLocal = dateInTimezone(startDate, timezone);
      const endDateLocal = dateInTimezone(endDate, timezone).add(1, "day");

      const bookedSlots = tzCalendarEvents
        .filter(
          (tzEvent) =>
            tzEvent.end_date_time.isSameOrAfter(startDateLocal, "minute") &&
            tzEvent.end_date_time.isSameOrBefore(endDateLocal, "minute")
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
      "Unexpected error trying to retrieve available date times by month!"
    );
    throw err;
  }
};

const retrieveAvailableTimes = async (
  eventType: EventType,
  date: string,
  timezone: string
): Promise<AvailableDate> => {
  try {
    const availableTimes: AvailableDate = { date, times: [] };

    const scheduleWithPeriods = await retrieveUserScheduleWithPeriods(
      eventType.schedule_id
    );

    // convert schedule periods to visitor's timezone
    const tzPeriods = convertScheduleTimezone(
      scheduleWithPeriods.periods,
      scheduleWithPeriods.schedule.timezone,
      timezone
    );

    const visitorCurrentDate = dateToTimezone(dayjs(), timezone);

    // grab all calendar events within given month in UTC
    const [dateStart, dateEnd] = getDateStartEnd(date);
    const dateStartUtc = dateToTimezone(
      dateInTimezone(dateStart, timezone),
      "Etc/UTC"
    );
    const dateEndUtc = dateToTimezone(
      dateInTimezone(dateEnd, timezone),
      "Etc/UTC"
    );

    // avoid retrieving events in the past
    const eventsStartDate = visitorCurrentDate.isAfter(dateStart)
      ? dateToTimezone(dateStart, "Etc/UTC")
      : dateStartUtc;

    const eventsEndDate = dateEndUtc.add(1, "day");

    const calendarEvents = await knexClient("calendar_events")
      .select("*")
      .leftJoin(
        "event_schedules",
        "calendar_events.schedule_id",
        "event_schedules.id"
      )
      .where("event_schedules.end_date_time", ">", eventsStartDate.unix())
      .where("event_schedules.end_date_time", "<", eventsEndDate.unix());

    const schedule = tzPeriods
      .filter((period) => period.day === dateStart.day())
      .map((period) => [
        period.start_time.date(dateStart.date()),
        period.end_time.date(dateStart.date()),
      ]) as TDayjsSlot[];
    const bookedSlots = calendarEvents
      .map((event) => ({
        start_date_time: dateToTimezone(event.start_date_time, timezone),
        end_date_time: dateToTimezone(event.end_date_time, timezone),
      }))
      .map((event) => [
        event.start_date_time,
        event.end_date_time,
      ]) as TDayjsSlot[];

    const availableTimesResult = getAvailableTimeSlots(
      schedule,
      bookedSlots,
      eventType.duration
    );

    availableTimes.times.push(
      ...(availableTimesResult.map((timeResult) => ({
        startTime: timeResult.from.format("HH:mm"),
        endTime: timeResult.to.format("HH:mm"),
      })) as AvailableTimeSlot[])
    );

    return availableTimes;
  } catch (err) {
    logger.error(
      "Unexpected error trying to retrieve available date times by date!"
    );
    throw err;
  }
};

const isDateAvailable = async (
  eventType: EventType,
  date: TTimeSlotString
): Promise<boolean> => {
  try {
    // dates expected as UTC unix timestamps
    const [startDateUnixUTC, endDateUnixUTC] = date;

    const scheduleWithPeriods = await retrieveUserScheduleWithPeriods(
      eventType.schedule_id
    );

    // convert schedule to UTC
    const tzPeriods = convertScheduleTimezone(
      scheduleWithPeriods.periods,
      scheduleWithPeriods.schedule.timezone,
      "Etc/UTC"
    );

    const dateStart = dateInTimezone(dayjs(startDateUnixUTC), "Etc/UTC");
    const dateEnd = dateInTimezone(dayjs(endDateUnixUTC), "Etc/UTC").add(
      1,
      "day"
    );

    const calendarEvents = await knexClient("calendar_events")
      .select("*")
      .leftJoin(
        "event_schedules",
        "calendar_events.schedule_id",
        "event_schedules.id"
      )
      .where("event_schedules.end_date_time", ">", dateStart.unix())
      .where("event_schedules.end_date_time", "<", dateEnd.unix());

    const schedule = tzPeriods
      .filter(
        (tzPeriod) =>
          tzPeriod.day === dateStart.day() || tzPeriod.day === dateEnd.day()
      )
      .map((tzPeriod) => [
        tzPeriod.start_time.day(tzPeriod.day),
        tzPeriod.end_time.day(tzPeriod.day),
      ]) as TDayjsSlot[];

    const bookedSlots = calendarEvents.map((event) => [
      dateInTimezone(event.start_date_time, "Etc/UTC"),
      dateInTimezone(event.end_date_time, "Etc/UTC"),
    ]) as TDayjsSlot[];

    const isAvailable = isTimeSlotAvailable(schedule, bookedSlots, [
      dateStart,
      dateEnd,
    ]);

    return isAvailable;
  } catch (err) {
    logger.error(
      "Unexpected error trying to determine if a time slot is valid for booking!"
    );
    throw err;
  }
};

type TErrorInfo = {
  client?: string;
  server?: string;
};
const handleGraphqlError = (error: any, info: TErrorInfo): never => {
  if (error instanceof ValidationError) {
    const { message } = error;
    throw new GraphQLError(message);
  } else if (error instanceof GraphQLError) throw error;

  const defaultErrorMessage =
    "Unexpected error trying to serve GraphQl request: ";

  const serverErrorMessage = `${info.server || defaultErrorMessage}\t ${error}`;
  logger.error(serverErrorMessage);

  const clientErrorMessage = info.client || defaultErrorMessage;
  throw new GraphQLError(clientErrorMessage);
};

export {
  isDateAvailable,
  handleGraphqlError,
  retrieveAvailableDates,
  retrieveAvailableTimes,
};
