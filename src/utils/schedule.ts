/**
 * Methods and classes used for generating the available time slots one can book an event in
 * and for determining the validity of booking a timeslot a
 * given a schedule and booked events constraints
 */

import dayjs, { Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

import { TDayjsSlot } from "../types";

dayjs.extend(customParseFormat);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(utc);
dayjs.extend(timezone);

type TOverlapSide = "lower" | "upper";

class TimeSlot {
  private _from: Dayjs;
  private _to: Dayjs;

  constructor(from: Dayjs, to: Dayjs) {
    if (to.isSameOrBefore(from, "minute"))
      throw new Error("Cannot instantiate a time slot with to <= from!");

    this._from = from.clone();
    this._to = to.clone();
  }

  isWithinBounds(boundedSlot: TimeSlot) {
    if (
      boundedSlot.from.isSameOrAfter(this._from, "minute") &&
      boundedSlot.to.isSameOrBefore(this._to, "minute")
    )
      return true;

    return false;
  }

  overlapsWith(overlappingSlot: TimeSlot): TOverlapSide | null {
    if (
      overlappingSlot.to.isSameOrAfter(this._from, "minute") &&
      overlappingSlot.to.isSameOrBefore(this._to, "minute")
    )
      return "upper";

    if (
      overlappingSlot.from.isSameOrAfter(this._from, "minute") &&
      overlappingSlot.from.isSameOrBefore(this._to, "minute")
    )
      return "lower";

    return null;
  }

  isEnveloped(envelopingSlot: TimeSlot) {
    if (envelopingSlot.isWithinBounds(this)) return true;
    return false;
  }

  cut(slot: TimeSlot): TimeSlot[] {
    if (this.isWithinBounds(slot)) {
      const areLowerBoundsIdentical = slot.from.isSame(this._from, "minute");
      const areUpperBoundsIdentical = slot.to.isSame(this._to, "minute");

      const newSlots: TimeSlot[] = [];
      if (!areLowerBoundsIdentical)
        newSlots.push(new TimeSlot(this._from, slot.from));
      if (!areUpperBoundsIdentical)
        newSlots.push(new TimeSlot(slot.to, this._to));

      return newSlots;
    } else if (this.isEnveloped(slot)) {
      return [];
    } else if (this.overlapsWith(slot)) {
      const overlapSide = this.overlapsWith(slot);

      if (overlapSide === "lower" && !slot.from.isSame(this._from))
        return [new TimeSlot(this._from, slot.from)];
      else if (overlapSide === "upper" && !slot.to.isSame(this._to))
        return [new TimeSlot(slot.to, this._to)];
      else return [];
    } else return [this];
  }

  slice(duration: number, offset: number): TimeSlot[] {
    const slices: TimeSlot[] = [];
    let start = this._from.clone();
    let end = start.add(duration, "minute");

    let curr = new TimeSlot(start, end);
    while (this.isWithinBounds(curr)) {
      slices.push(curr);
      start = start.add(offset, "minute");
      end = start.add(duration, "minute");
      curr = new TimeSlot(start, end);
    }

    return slices;
  }

  toString() {
    return [this._from.format("HH:mm"), this._to.format("HH:mm")];
  }

  get from() {
    return this._from.clone();
  }
  get to() {
    return this._to.clone();
  }
}

class TimePeriod {
  private _schedule: TimeSlot[] = [];

  constructor(slots: TimeSlot[]) {
    for (const timeSlot of slots) {
      this._schedule.push(timeSlot);
    }
  }

  erase(bookedSlot: TimeSlot) {
    const alteredSchedule: TimeSlot[] = [];

    for (const scheduleSlot of this._schedule) {
      const alteredSlot = scheduleSlot.cut(bookedSlot);
      alteredSchedule.push(...alteredSlot);
    }

    this._schedule = alteredSchedule;
  }

  getAvailableMeetings(meetingDuration: number, offset: number): TimeSlot[] {
    return this._schedule
      .map((slot) => slot.slice(meetingDuration, offset))
      .flat();
  }

  isSlotAvailable(slot: TimeSlot): boolean {
    for (const timeSlot of this._schedule) {
      if (timeSlot.isWithinBounds(slot)) return true;
    }

    return false;
  }
}

const getAvailableTimeSlots = (
  schedule: TDayjsSlot[],
  booked: TDayjsSlot[],
  duration: number,
  offset?: number
): TimeSlot[] => {
  let timeSlots: TimeSlot[] = [];

  for (const dayjsSlot of schedule) {
    const timeSlot = new TimeSlot(dayjsSlot[0], dayjsSlot[1]);
    timeSlots.push(timeSlot);
  }

  const availablePeriod = new TimePeriod(timeSlots);

  for (const bookedDayjsSlot of booked) {
    const bookedSlot = new TimeSlot(bookedDayjsSlot[0], bookedDayjsSlot[1]);
    availablePeriod.erase(bookedSlot);
  }

  const availableMeetings = availablePeriod.getAvailableMeetings(
    duration,
    offset || duration
  );

  return availableMeetings;
};

const isTimeSlotAvailable = (
  schedule: TDayjsSlot[],
  booked: TDayjsSlot[],
  slot: TDayjsSlot
) => {
  let scheduleTimeSlots: TimeSlot[] = [];

  for (const dayjsSlot of schedule) {
    const timeSlot = new TimeSlot(dayjsSlot[0], dayjsSlot[1]);
    scheduleTimeSlots.push(timeSlot);
  }

  const timePeriod = new TimePeriod(scheduleTimeSlots);

  for (const bookedDayjsSlot of booked) {
    const bookedSlot = new TimeSlot(bookedDayjsSlot[0], bookedDayjsSlot[1]);
    timePeriod.erase(bookedSlot);
  }

  return timePeriod.isSlotAvailable(new TimeSlot(slot[0], slot[1]));
};

const getMonthStartEnd = (
  month: string,
  dateFormat = "DD-MM-YYYY"
): [Dayjs, Dayjs] => {
  let startDateTime = dayjs(`01-${month}`, dateFormat);
  let endDateTime = dayjs(
    `${startDateTime.daysInMonth()}-${month}`,
    dateFormat
  );

  startDateTime = startDateTime.hour(0).minute(0).second(0);
  endDateTime = endDateTime.hour(23).minute(59).second(59);

  return [startDateTime, endDateTime];
};

const getDateStartEnd = (
  date: string,
  dateFormat = "DD-MM-YYYY"
): [Dayjs, Dayjs] => {
  const dateStart = dayjs(date, dateFormat).hour(0).minute(0).second(0);
  const dateEnd = dayjs(date, dateFormat).hour(23).minute(59).second(59);

  return [dateStart, dateEnd];
};

const convertDayTime = (
  day: number,
  time: string,
  tz: string,
  convertTz: string
): [number, string] => {
  const timeSplit = time.split(":");
  const hour = parseInt(timeSplit[0]);
  const minutes = parseInt(timeSplit[1]);

  const dateUtc = dayjs();
  const dateLocal = dateUtc.tz(tz).day(day).hour(hour).minute(minutes);

  const dateConvert = dateLocal.tz(convertTz);

  return [dateConvert.day(), dateConvert.format("HH:mm")];
};

const dayTimeToDate = (day: number, time: string, tz: string): Dayjs => {
  const timeStrSplit = time.split(":");
  const timeHour = parseInt(timeStrSplit[0]);
  const timeMinutes = parseInt(timeStrSplit[1]);

  const date = dayjs().day(day).hour(timeHour).minute(timeMinutes);
  const dateLocal = dayjs.tz(date, tz);

  return dateLocal;
};

const dateInTimezone = (date: Dayjs, tz: string) => dayjs.tz(date, tz);
const dateToTimezone = (date: Dayjs, tz: string) => date.tz(tz);

export {
  getAvailableTimeSlots,
  isTimeSlotAvailable,
  getMonthStartEnd,
  getDateStartEnd,
  convertDayTime,
  dayTimeToDate,
  dateInTimezone,
  dateToTimezone,
};
