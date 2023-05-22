import { describe, test, expect } from "@jest/globals";
import {
  getAvailableTimeSlots,
  isTimeSlotAvailable,
  convertDayTime,
} from "../../src/utils/schedule";

type TTimeSlotString = [string, string];

describe("Calendar Scheduling Algorithms", () => {
  test("convert day/time at tz into day/time at another tz", () => {
    const day = 0; // sunday
    const time = "02:00";
    const timezone = "Europe/London";
    const convertTimezone = "America/New_York";

    const expectedDayTime = [6, "21:00"]; // saturday at 21:00 in America/New_York
    expect(convertDayTime(day, time, timezone, convertTimezone)).toEqual(
      expectedDayTime
    );
  });

  test("retrieve available time slots given a schedule and some booked slots", () => {
    const schedule = [
      ["09:00", "14:00"],
      ["16:00", "18:45"],
    ] as TTimeSlotString[];
    const bookedSlots = [
      ["09:15", "09:45"],
      ["10:30", "11:00"],
      ["12:00", "13:15"],
      ["18:15", "18:45"],
    ] as TTimeSlotString[];
    const duration = 30; // minutes

    const expectedResponse = [
      ["09:45", "10:15"],
      ["11:00", "11:30"],
      ["11:30", "12:00"],
      ["13:15", "13:45"],
      ["16:00", "16:30"],
      ["16:30", "17:00"],
      ["17:00", "17:30"],
      ["17:30", "18:00"],
    ];

    const response = getAvailableTimeSlots(schedule, bookedSlots, duration);
    console.log(response);
    expect(response).toEqual(expectedResponse);
  });

  test("check if some meetings are available for booking", () => {
    const schedule = [["12:00", "18:00"]] as TTimeSlotString[];
    const booked = [
      ["12:25", "12:55"],
      ["15:30", "16:30"],
      ["16:45", "17:15"],
    ] as TTimeSlotString[];

    const validMeetings = [
      ["12:00", "12:20"],
      ["12:55", "13:55"],
      ["15:00", "15:30"],
    ];
    const invalidMeetings = [
      ["12:20", "12:40"],
      ["15:00", "15:45"],
      ["16:50", "17:10"],
      ["17:10", "18:00"],
      ["09:00", "09:45"],
      ["18:30", "21:00", ["17:30", "18:10"]],
    ];

    for (const validMeeting of validMeetings) {
      expect(
        isTimeSlotAvailable(schedule, booked, validMeeting as TTimeSlotString)
      ).toBe(true);
    }

    for (const invalidMeeting of invalidMeetings) {
      expect(
        isTimeSlotAvailable(schedule, booked, invalidMeeting as TTimeSlotString)
      ).toBe(false);
    }
  });
});
