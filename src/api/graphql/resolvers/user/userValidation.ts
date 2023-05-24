import Joi from "joi";

const userCreateValidationSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(50).required(),
  email: Joi.string().email().required(),
  firstName: Joi.string()
    .max(30)
    .pattern(/^[a-zA-Z\s]*$/)
    .required(),
  lastName: Joi.string()
    .max(30)
    .pattern(/^[a-zA-Z\s]*$/)
    .required(),
  password: Joi.string()
    .max(200)
    .pattern(new RegExp(/^(?=.*[a-z])(?=.*[A-Z])(?=.*d)[a-zA-Zd]{8,}$/))
    .required()
    .messages({
      "string.pattern":
        "You must provide a password with minimum 8 characters, with at least one uppercase letter, one lowercase letter and one number!",
    }),
});

const userLoginValidationSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().max(200).required(),
});

export { userCreateValidationSchema, userLoginValidationSchema };
