import Joi from "joi";

import { isValidTimeZone } from "../../../../utils";

const validLocationTypes = ["G_MEET", "ADDRESS", "PHONE"];
const validQuestionTypes = ["TEXT", "RADIO", "CHECKBOX"];

const availableTimesParamsValidationSchema = Joi.object({
  date: Joi.string()
    .pattern(
      new RegExp(/^([0-2][0-9]|(3)[0-1])-(((0)[0-9])|((1)[0-2]))-\d{4}$/)
    )
    .required()
    .messages({
      "string.pattern.base":
        "The date you provide has to adhere to the following pattern: 'DD-MM-YYYY'",
    }),
  timezone: Joi.string().custom(isValidTimeZone).required(),
});

const availableDatesParamsValidationSchema = Joi.object({
  month: Joi.string()
    .pattern(new RegExp(/^((0[1-9])|(1[0-2]))-(\d{4})$/))
    .required()
    .messages({
      "string.pattern.base":
        "The provided month must adhere to the following format: 'MM-YYYY' !",
    }),
  timezone: Joi.string().custom(isValidTimeZone).required(),
});

const eventTypeLocationValidationObj = Joi.object({
  type: Joi.string()
    .allow(...validLocationTypes)
    .only()
    .required()
    .messages({
      "any.only":
        "You can only provide one of the following location types: 'G_MEET', 'ADDRESS' or 'PHONE'!",
    }),
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
  timezone: Joi.string().custom(isValidTimeZone).required(),
  periods: Joi.array()
    .items(
      Joi.object({
        day: Joi.number().integer().min(0).max(6).required(),
        startTime: Joi.string()
          .pattern(new RegExp(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/))
          .required()
          .messages({
            "string.pattern.base":
              "Your start and end times must adhere to the following format: 'HH:mm' !",
          }),
        endTime: Joi.string()
          .pattern(new RegExp(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/))
          .required()
          .messages({
            "string.pattern.base":
              "Your start and end times must adhere to the following format: 'HH:mm' !",
          }),
      })
    )
    .required(),
});

const eventTypeQuestionsValidationArr = Joi.array().items(
  Joi.object({
    type: Joi.string()
      .allow(...validQuestionTypes)
      .only()
      .required()
      .messages({
        "any.only":
          "You can only provide one of the following question types: 'TEXT', 'RADIO' or 'CHECKBOX'",
      }),
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
    .max(255)
    .pattern(new RegExp(/^[a-zA-Z0-9\s]*$/))
    .required()
    .messages({
      "string.pattern.base":
        "The name can only include alphanumeric characters and spaces!",
    }),
  link: Joi.string()
    .min(3)
    .max(100)
    .pattern(new RegExp(/^[a-zA-Z0-9_-]*$/))
    .required()
    .messages({
      "string.pattern.base":
        "The link can only include url-safe characters: a-z, A-Z, 0-9, underscores and hyphens!",
    }),
  duration: Joi.number()
    .integer()
    .min(1)
    .max(60 * 24)
    .required()
    .messages({
      "number.min":
        "The event type minimum duration must be of at least 1 minute",
      "number.max":
        "The event type maximum duration must be of at most 24 hours (1440 minutes)",
    }),
  collectsPayments: Joi.boolean().required(),
  description: Joi.string(),
  paymentFee: Joi.number().min(1).max(1000),
  location: eventTypeLocationValidationObj.required(),
  schedule: eventTypeScheduleValidationObj.required(),
  questions: eventTypeQuestionsValidationArr.required(),
}).custom((obj) => {
  const { collectsPayments, paymentFee } = obj;
  if (collectsPayments && !paymentFee)
    throw new Error(
      "You must provide a 'paymentFee' value if you wish to create a payment-collecting event type!"
    );

  return obj;
});

const eventTypeUpdateParamsValidationSchema = Joi.object({
  eventTypeId: Joi.string().guid().required(),
  params: Joi.object({
    name: Joi.string()
      .max(100)
      .pattern(new RegExp(/^[a-zA-Z0-9\s]*$/))
      .messages({
        "string.pattern.base":
          "The name can only include alphanumeric characters and spaces!",
      }),
    duration: Joi.number()
      .integer()
      .min(1)
      .max(60 * 24),
    description: Joi.string(),
    isActive: Joi.boolean(),
    location: eventTypeLocationValidationObj,
  }),
});

const eventTypeDeleteParamsValidationSchema = Joi.object({
  eventTypeId: Joi.string().guid().required(),
});

const eventTypeScheduleUpdateParamsValidationSchema = Joi.object({
  eventTypeId: Joi.string().guid().required(),
  params: Joi.object({
    schedule: eventTypeScheduleValidationObj.required(),
  }),
});

const eventTypeUpdatePaymentParamsValidationSchema = Joi.object({
  eventTypeId: Joi.string().guid().required(),
  params: Joi.object({
    collectsPayments: Joi.boolean().required(),
    paymentFee: Joi.number().min(1).max(1000),
  }),
}).custom((obj) => {
  const { params } = obj;
  const { collectsPayments, paymentFee } = params;

  if (collectsPayments && !paymentFee)
    throw new Error(
      "You must provide a 'paymentFee' value if you wish to create a payment-collecting event type!"
    );

  return obj;
});

const eventTypeUpdateQuestionsParamsValidationSchema = Joi.object({
  eventTypeId: Joi.string().guid().required(),
  params: Joi.object({
    questions: eventTypeQuestionsValidationArr.required(),
  }),
});

export {
  eventTypeDeleteParamsValidationSchema,
  eventTypeUpdateParamsValidationSchema,
  availableDatesParamsValidationSchema,
  availableTimesParamsValidationSchema,
  eventTypeCreateInputValidationSchema,
  eventTypeUpdatePaymentParamsValidationSchema,
  eventTypeScheduleUpdateParamsValidationSchema,
  eventTypeUpdateQuestionsParamsValidationSchema,
};
