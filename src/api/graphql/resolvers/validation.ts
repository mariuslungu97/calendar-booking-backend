import Joi from "joi";

const allowedOrderValues = ["ASC", "DESC"];

const cursorPaginationParamsValidationSchema = Joi.object({
  cursor: Joi.string().allow(""),
  order: Joi.string().valid(...allowedOrderValues),
  take: Joi.number().integer().min(1),
});

export { cursorPaginationParamsValidationSchema };
