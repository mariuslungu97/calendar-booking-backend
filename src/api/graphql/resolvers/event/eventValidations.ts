import Joi from "joi";

import { isValidTimeZone } from "../../../../utils";

const bookEventParamsValidationSchema = Joi.object({
  username: Joi.string().required(),
  eventTypeLink: Joi.string().required(),
  params: Joi.object({
    inviteeEmail: Joi.string().email().required(),
    inviteeFullName: Joi.string()
      .pattern(new RegExp(/^[a-zA-Z\s]*$/))
      .required()
      .messages({
        "string.pattern.base":
          "The name can only include alphabetic characters and space!",
      }),
    inviteeTimezone: Joi.string().custom(isValidTimeZone).required(),
    date: Joi.string()
      .pattern(
        new RegExp(/^([0-2][0-9]|(3)[0-1])-(((0)[0-9])|((1)[0-2]))-\d{4}$/)
      )
      .required()
      .messages({
        "string.pattern.base":
          "The date you provide has to adhere to the following pattern: 'DD-MM-YYYY'",
      }),
    startTime: Joi.string()
      .pattern(new RegExp(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/))
      .required()
      .messages({
        "string.pattern.base":
          "Your start and end times must adhere to the following format: 'HH:mm' !",
      }),
    answers: Joi.array()
      .items(
        Joi.object({
          questionId: Joi.string().guid().required(),
          answer: Joi.array().items(Joi.string()).required(),
        })
      )
      .required(),
  }),
});

const updateEventTimeParamsValidationSchema = Joi.object({
  eventId: Joi.string().guid().required(),
  params: Joi.object({
    startDateTime: Joi.date().iso().required(),
    endDateTime: Joi.date().iso().required(),
  }),
});

const cancelEventParamsValidationSchema = Joi.object({
  eventId: Joi.string().guid().required(),
});

export {
  bookEventParamsValidationSchema,
  updateEventTimeParamsValidationSchema,
  cancelEventParamsValidationSchema,
};
