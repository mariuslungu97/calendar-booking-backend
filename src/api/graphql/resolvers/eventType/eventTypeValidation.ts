import Joi from "joi";

import { isValidTimeZone } from "../../../../utils";

const validLocationTypes = ["G_MEET", "ADDRESS", "PHONE"];
const validQuestionTypes = ["TEXT", "RADIO", "CHECKBOX"];

const availableTimesParamsValidationSchema = Joi.object({
  date: Joi.string()
    .pattern(new RegExp(/^(0?[1-9]|[12][0-9]|3[01])-(0?[1-9]|1[012])-\d{4}$/))
    .required(),
  timezone: Joi.date().custom(isValidTimeZone).required(),
});

const availableDatesParamsValidationSchema = Joi.object({
  month: Joi.string()
    .pattern(new RegExp(/^((0[1-9])|(1[0-2]))-(\d{4})$/))
    .required(), // matches MM-YYYY
  timezone: Joi.date().custom(isValidTimeZone).required(),
});

const eventTypeLocationValidationObj = Joi.object({
  type: Joi.string()
    .valid(...validLocationTypes)
    .required(),
  value: Joi.string(),
}).custom((obj) => {
  const { type, value } = obj;

  if ((type === "ADDRESS" || type === "PHONE") && !value)
    throw new Error(
      "You must provide a location value if the type is set to 'ADDRESS' or 'PHONE'"
    );

  return obj;
});

const eventTypeScheduleValidationObj = Joi.object({
  timezone: Joi.string().required(),
  periods: Joi.array()
    .items(
      Joi.object({
        day: Joi.number().integer().min(0).max(6).required(),
        startTime: Joi.string()
          .pattern(new RegExp(/^[0-2][0-3]:[0-5][0-9]$/))
          .required(),
        endTime: Joi.string()
          .pattern(new RegExp(/^[0-2][0-3]:[0-5][0-9]$/))
          .required(),
      })
    )
    .required(),
});

const eventTypeQuestionsValidationArr = Joi.array().items(
  Joi.object({
    type: Joi.string()
      .valid(...validQuestionTypes)
      .required(),
    label: Joi.string().max(100).required(),
    isOptional: Joi.boolean().required(),
    possibleAnswers: Joi.array().items(Joi.string()),
  }).custom((obj) => {
    if (
      (obj.type === "RADIO" || obj.type === "CHECKBOX") &&
      !obj.possibleAnswers
    )
      throw new Error(
        "You must provide an array of possible answers if your question is of type 'RADIO' or 'CHECKBOX'"
      );

    return obj;
  })
);

const eventTypeCreateInputValidationSchema = Joi.object({
  name: Joi.string()
    .max(100)
    .pattern(new RegExp(/^[a-zA-Z\s]*$/))
    .required(), // only letters and spaces
  link: Joi.string()
    .min(3)
    .max(50)
    .pattern(new RegExp(/^[a-zA-Z0-9_-]*$/))
    .required(),
  duration: Joi.number()
    .integer()
    .min(1)
    .max(60 * 24)
    .required(),
  collectsPayments: Joi.boolean().required(),
  description: Joi.string(),
  paymentFee: Joi.number().min(1),
  location: eventTypeLocationValidationObj.required(),
  schedule: eventTypeScheduleValidationObj.required(),
  questions: eventTypeQuestionsValidationArr.required(),
});

const eventTypeUpdateParamsValidationSchema = Joi.object({
  eventTypeId: Joi.string().required(),
  params: Joi.object({
    name: Joi.string()
      .max(100)
      .pattern(new RegExp(/^[a-zA-Z\s]*$/)),
    duration: Joi.number()
      .integer()
      .min(1)
      .max(60 * 24),
    description: Joi.string(),
    isActive: Joi.boolean(),
    location: eventTypeLocationValidationObj,
  }),
});

const eventTypeScheduleUpdateParamsValidationSchema = Joi.object({
  eventTypeId: Joi.string().required(),
  params: Joi.object({
    schedule: eventTypeScheduleValidationObj.required(),
  }),
});

const eventTypeUpdatePaymentParamsValidationSchema = Joi.object({
  eventTypeId: Joi.string().required(),
  params: Joi.object({
    collectsPayments: Joi.boolean().required(),
    paymentFee: Joi.number().min(1),
  }),
});

const eventTypeUpdateQuestionsParamsValidationSchema = Joi.object({
  eventTypeId: Joi.string().required(),
  params: Joi.object({
    questions: eventTypeQuestionsValidationArr.required(),
  }),
});

export {
  eventTypeUpdateParamsValidationSchema,
  availableDatesParamsValidationSchema,
  availableTimesParamsValidationSchema,
  eventTypeCreateInputValidationSchema,
  eventTypeUpdatePaymentParamsValidationSchema,
  eventTypeScheduleUpdateParamsValidationSchema,
  eventTypeUpdateQuestionsParamsValidationSchema,
};
