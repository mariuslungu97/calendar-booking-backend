import Joi from "joi";

const passwordValidationChain = Joi.string()
  .max(100)
  .pattern(new RegExp(/^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9]).{8,}$/))
  .required()
  .messages({
    "string.pattern.base":
      "You must provide a password with minimum 8 characters, with at least one uppercase letter, one lowercase letter and one number!",
  });

const loginValidationSchema = Joi.object({
  password: passwordValidationChain,
  email: Joi.string().email().required(),
});

const createAccountValidationSchema = Joi.object({
  password: passwordValidationChain,
  username: Joi.string().alphanum().min(3).max(50).required(),
  email: Joi.string().email().required(),
  firstName: Joi.string()
    .max(30)
    .pattern(new RegExp(/^[a-zA-Z\s]*$/))
    .required()
    .messages({
      "string.pattern.base":
        "Your first name can only contain alphabetic characters!",
    }),
  lastName: Joi.string()
    .max(30)
    .pattern(new RegExp(/^[a-zA-Z\s]*$/))
    .required()
    .messages({
      "string.pattern.base":
        "Your first name can only contain alphabetic characters!",
    }),
});

const toggle2FaParamsValidationSchema = Joi.object({
  activate: Joi.boolean().required(),
});

const connectStripeValidationSchema = Joi.object({
  businessType: Joi.string().allow("individual", "business").only().messages({
    "any.only":
      "The supported business types are: 'individual' and 'business'!",
  }),
});

export {
  loginValidationSchema,
  connectStripeValidationSchema,
  createAccountValidationSchema,
  toggle2FaParamsValidationSchema,
};
