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

dayjs.extend(customParseFormat);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(utc);
dayjs.extend(timezone);

type TTimeSlotString = [string, string];

class TimeSlot {
  private _from: Dayjs;
  private _to: Dayjs;

  static fromDayJs(from: Dayjs, to: Dayjs) {
    return new TimeSlot([from.format("HH:mm"), to.format("HH:mm")]);
  }

  constructor(timeSlotStr: TTimeSlotString) {
    this._from = dayjs(timeSlotStr[0], "HH:mm");
    this._to = dayjs(timeSlotStr[1], "HH:mm");
  }

  get from() {
    return this._from.clone();
  }
  get to() {
    return this._to.clone();
  }

  isWithinBounds(otherTimeSlot: TimeSlot) {
    return (
      otherTimeSlot.from.isSameOrAfter(this._from, "minute") &&
      otherTimeSlot.to.isSameOrBefore(this._to, "minute")
    );
  }

  getAvailableMeetings(meetingDuration: number, offset: number): TimeSlot[] {
    const possibleMeetings: TimeSlot[] = [];

    let start = this._from.clone();
    let end = this._from.clone().add(meetingDuration, "minute");

    let curr = TimeSlot.fromDayJs(start, end);
    while (this.isWithinBounds(curr)) {
      possibleMeetings.push(curr);
      start = start.add(offset, "minute");
      end = start.clone().add(meetingDuration, "minute");
      curr = TimeSlot.fromDayJs(start, end);
    }

    return possibleMeetings;
  }

  halve(timeSlot: TimeSlot): TimeSlot[] {
    if (!this.isWithinBounds(timeSlot))
      throw new Error(
        "You cannot subtract a timeslot which is not within the bounds of the timeslot being subtracted from!"
      );

    const former = TimeSlot.fromDayJs(this._from, timeSlot.from);
    const latter = TimeSlot.fromDayJs(timeSlot.to, this._to);

    return [former, latter];
  }

  toString(): TTimeSlotString {
    return [this.from.format("HH:mm"), this.to.format("HH:mm")];
  }
}

class TimePeriod {
  private _slots: TimeSlot[] = [];

  constructor(slots: TTimeSlotString[]) {
    for (const timeSlotStr of slots) {
      const timeSlot = new TimeSlot(timeSlotStr);
      this._slots.push(timeSlot);
    }
  }

  erase(slot: TimeSlot) {
    let subtractSlotIdx = -1;

    const subtractedSlot = this._slots.find((timeSlot, idx) => {
      if (timeSlot.isWithinBounds(slot)) {
        subtractSlotIdx = idx;
        return timeSlot;
      }
    });

    if (subtractSlotIdx !== -1 && subtractedSlot) {
      this._slots.splice(subtractSlotIdx, 1, ...subtractedSlot.halve(slot));
    }
  }

  getAvailableMeetings(meetingDuration: number, offset: number): TimeSlot[] {
    return this._slots
      .map((slot) => slot.getAvailableMeetings(meetingDuration, offset))
      .flat();
  }

  isSlotAvailable(slot: TimeSlot): boolean {
    for (const timeSlot of this._slots) {
      if (timeSlot.isWithinBounds(slot)) return true;
    }

    return false;
  }
}

const getAvailableTimeSlots = (
  schedule: TTimeSlotString[],
  booked: TTimeSlotString[],
  duration: number,
  offset?: number
) => {
  const availablePeriod = new TimePeriod(schedule);

  for (const bookedSlotStr of booked) {
    const bookedSlot = new TimeSlot(bookedSlotStr);
    availablePeriod.erase(bookedSlot);
  }

  const availableMeetings = availablePeriod.getAvailableMeetings(
    duration,
    offset || duration
  );
  return availableMeetings.map((meeting) => meeting.toString());
};

const isTimeSlotAvailable = (
  schedule: TTimeSlotString[],
  booked: TTimeSlotString[],
  slot: TTimeSlotString
) => {
  const timePeriod = new TimePeriod(schedule);

  for (const bookedSlotStr of booked) {
    const bookedSlot = new TimeSlot(bookedSlotStr);
    timePeriod.erase(bookedSlot);
  }

  return timePeriod.isSlotAvailable(new TimeSlot(slot));
};

const getMonthStartEnd = (month: string): [Dayjs, Dayjs] => {
  let startDateTime = dayjs(`01-${month}`, "DD-MM-YYYY");
  let endDateTime = dayjs(
    `${startDateTime.daysInMonth()}-${month}`,
    "DD-MM-YYYY"
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

export {
  getAvailableTimeSlots,
  isTimeSlotAvailable,
  getMonthStartEnd,
  getDateStartEnd,
  convertDayTime,
};
