import dayjs from "dayjs";
import { describe, test, expect } from "@jest/globals";
import {
  getAvailableTimeSlots,
  isTimeSlotAvailable,
} from "../../src/utils/schedule";

import { TDayjsSlot } from "../../src/types";

const getDate = (day: number, time: string) =>
  dayjs()
    .day(day)
    .hour(parseInt(time.split(":")[0]))
    .minute(parseInt(time.split(":")[1]));

describe("Calendar Scheduling Algorithms", () => {
  test("retrieve available time slots given a schedule and some booked slots", () => {
    const schedule = [
      [getDate(0, "09:00"), getDate(0, "15:00")],
      [getDate(0, "23:00"), getDate(0, "23:59")],
    ] as TDayjsSlot[];

    const bookedSlots = [
      [getDate(0, "09:00"), getDate(0, "09:30")],
      [getDate(0, "10:30"), getDate(0, "11:15")],
      [getDate(0, "11:30"), getDate(0, "12:30")],
      [getDate(0, "14:00"), getDate(0, "14:20")],
    ] as TDayjsSlot[];

    const result = getAvailableTimeSlots(schedule, bookedSlots, 30);
    result.map((ts) => console.log(`${ts.toString()}`));
    expect(result.length).not.toBe(0);
  });

  test("check if some meetings are available for booking", () => {
    const schedule = [
      [getDate(0, "09:00"), getDate(0, "15:00")],
    ] as TDayjsSlot[];

    const bookedSlots = [
      [getDate(0, "09:00"), getDate(0, "09:30")],
      [getDate(0, "10:30"), getDate(0, "11:15")],
      [getDate(0, "11:30"), getDate(0, "12:30")],
      [getDate(0, "14:00"), getDate(0, "14:20")],
    ] as TDayjsSlot[];

    const validSlots = [
      [getDate(0, "09:30"), getDate(0, "10:00")],
      [getDate(0, "13:00"), getDate(0, "14:00")],
    ] as TDayjsSlot[];

    const invalidSlots = [
      [getDate(0, "10:00"), getDate(0, "10:35")],
      [getDate(0, "11:10"), getDate(0, "11:30")],
      [getDate(0, "14:10"), getDate(0, "14:45")],
    ] as TDayjsSlot[];

    for (const validSlot of validSlots) {
      const isValid = isTimeSlotAvailable(schedule, bookedSlots, validSlot);
      expect(isValid).toBe(true);
    }

    for (const invalidSlot of invalidSlots) {
      const isValid = isTimeSlotAvailable(schedule, bookedSlots, invalidSlot);
      expect(isValid).toBe(false);
    }
  });
});
