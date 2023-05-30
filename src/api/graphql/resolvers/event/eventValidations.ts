import Joi from "joi";

import { isValidTimeZone } from "../../../../utils";

const bookEventParamsValidationSchema = Joi.object({
  username: Joi.string().required(),
  eventTypeLink: Joi.string().required(),
  params: Joi.object({
    inviteeEmail: Joi.string().email().required(),
    inviteeFullName: Joi.string()
      .pattern(new RegExp(/^[a-zA-Z\s]*$/))
      .required(),
    inviteeTimezone: Joi.string().custom(isValidTimeZone).required(),
    startDateTime: Joi.date().timestamp("unix").required(),
    endDateTime: Joi.date().timestamp("unix").required(),
  }),
});

const updateEventTimeParamsValidationSchema = Joi.object({
  eventId: Joi.string().required(),
  params: Joi.object({
    startDateTime: Joi.date().timestamp("unix").required(),
    endDateTime: Joi.date().timestamp("unix").required(),
  }),
});

const cancelEventParamsValidationSchema = Joi.object({
  eventId: Joi.string().required(),
});

export {
  bookEventParamsValidationSchema,
  updateEventTimeParamsValidationSchema,
  cancelEventParamsValidationSchema,
};
