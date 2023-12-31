import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  return knex.schema
    .raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    .then(() => {
      return knex.schema
        .hasTable("stripe_accounts")
        .then((exists) => {
          if (!exists) {
            return knex.schema.createTable("stripe_accounts", (table) => {
              table.string("id").primary(); // equal to stripe_account_id

              table.boolean("details_submitted").defaultTo(false).notNullable();
              table.boolean("charges_enabled").defaultTo(false).notNullable();
              table
                .boolean("capabilities_enabled")
                .defaultTo(false)
                .notNullable();

              table
                .timestamp("created_at", { precision: 0 })
                .defaultTo(knex.fn.now(0))
                .notNullable();
              table
                .timestamp("updated_at", { precision: 0 })
                .defaultTo(knex.fn.now(0))
                .notNullable();
            });
          }
          return;
        })
        .then(() => {
          return knex.schema.hasTable("users").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("users", (table) => {
                table
                  .uuid("id")
                  .primary()
                  .defaultTo(knex.raw("uuid_generate_v4()"));
                table
                  .string("username")
                  .unique()
                  .checkLength("<=", 50)
                  .notNullable();

                table.string("stripe_account_id");
                table
                  .foreign("stripe_account_id")
                  .references("id")
                  .inTable("stripe_accounts")
                  .onDelete("SET NULL");

                table.string("email").notNullable().unique();
                table.string("password").notNullable();

                table.string("first_name").notNullable();
                table.string("last_name").notNullable();

                table
                  .boolean("is_email_verified")
                  .notNullable()
                  .defaultTo(false);
                table
                  .boolean("is_2fa_activated")
                  .notNullable()
                  .defaultTo(false);

                table.boolean("is_deleted").notNullable().defaultTo(false);
                table.timestamp("deleted_at");

                table.string("calendar_sync_token");

                table
                  .timestamp("created_at", { precision: 0 })
                  .defaultTo(knex.fn.now(0))
                  .notNullable();
              });
            }
            return;
          });
        })
        .then(() => {
          return knex.schema.hasTable("oauth_connections").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("oauth_connections", (table) => {
                // composite primary key - user_id & provider
                table.uuid("user_id");
                table.enu("provider", ["GOOGLE"], {
                  enumName: "provider_type",
                  useNative: true,
                });

                table.string("access_token").notNullable();
                table.string("refresh_token");

                table
                  .timestamp("created_at", { precision: 0 })
                  .defaultTo(knex.fn.now(0))
                  .notNullable();

                table.primary(["user_id", "provider"]);
              });
            }
            return;
          });
        })
        .then(() => {
          return knex.schema.hasTable("schedules").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("schedules", (table) => {
                table
                  .uuid("id")
                  .primary()
                  .defaultTo(knex.raw("uuid_generate_v4()"));

                table.uuid("user_id");
                table
                  .foreign("user_id")
                  .references("id")
                  .inTable("users")
                  .onDelete("CASCADE");

                table.string("timezone").notNullable();
              });
            }
            return;
          });
        })
        .then(() => {
          return knex.schema.hasTable("schedule_periods").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("schedule_periods", (table) => {
                table
                  .uuid("id")
                  .primary()
                  .defaultTo(knex.raw("uuid_generate_v4()"));

                table.uuid("schedule_id");
                table
                  .foreign("schedule_id")
                  .references("id")
                  .inTable("schedules")
                  .onDelete("CASCADE");

                table.smallint("day").notNullable().checkBetween([0, 6]);
                table.time("start_time").notNullable();
                table.time("end_time").notNullable();
              });
            }
            return;
          });
        })
        .then(() => {
          return knex.schema.hasTable("event_types").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("event_types", (table) => {
                table
                  .uuid("id")
                  .primary()
                  .defaultTo(knex.raw("uuid_generate_v4()"));

                table.uuid("user_id");
                table
                  .foreign("user_id")
                  .references("id")
                  .inTable("users")
                  .onDelete("SET NULL");

                table.uuid("schedule_id");
                table
                  .foreign("schedule_id")
                  .references("id")
                  .inTable("schedules")
                  .onDelete("SET NULL");

                table.string("link").notNullable().checkLength("<=", 50);
                table.string("name").notNullable();
                table.text("description");

                table.integer("duration").unsigned().notNullable();

                table.boolean("is_active").notNullable().defaultTo(true);

                table.boolean("collects_payments").notNullable();
                table.specificType("payment_fee", "NUMERIC(6,2)");

                table.enu("location", ["G_MEET", "ADDRESS", "PHONE"], {
                  enumName: "location_type",
                  useNative: true,
                });
                table.string("location_value");

                table.string("stripe_price_id");
                table.string("stripe_product_id");

                table
                  .timestamp("created_at", { precision: 0 })
                  .defaultTo(knex.fn.now(0))
                  .notNullable();
                table
                  .timestamp("updated_at", { precision: 0 })
                  .defaultTo(knex.fn.now(0))
                  .notNullable();
              });
            }
            return;
          });
        })
        .then(() => {
          return knex.schema.hasTable("event_type_questions").then((exists) => {
            if (!exists) {
              return knex.schema.createTable(
                "event_type_questions",
                (table) => {
                  table
                    .uuid("id")
                    .primary()
                    .defaultTo(knex.raw("uuid_generate_v4()"));

                  table.uuid("event_type_id");
                  table
                    .foreign("event_type_id")
                    .references("id")
                    .inTable("event_types")
                    .onDelete("CASCADE");

                  table.enu("type", ["TEXT", "RADIO", "CHECKBOX"], {
                    useNative: true,
                    enumName: "question_type",
                  });

                  table.string("label").notNullable();
                  table.smallint("order").notNullable();
                  table.boolean("is_optional").notNullable();
                }
              );
            }
            return;
          });
        })
        .then(() => {
          return knex.schema
            .hasTable("event_type_question_possible_answers")
            .then((exists) => {
              if (!exists) {
                return knex.schema.createTable(
                  "event_type_question_possible_answers",
                  (table) => {
                    table
                      .uuid("id")
                      .primary()
                      .defaultTo(knex.raw("uuid_generate_v4()"));

                    table.uuid("question_id");
                    table
                      .foreign("question_id")
                      .references("id")
                      .inTable("event_type_questions")
                      .onDelete("CASCADE");

                    table.string("value").notNullable().checkLength("<=", 50);
                  }
                );
              }
              return;
            });
        })
        .then(() => {
          return knex.schema.hasTable("event_schedules").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("event_schedules", (table) => {
                table
                  .uuid("id")
                  .primary()
                  .defaultTo(knex.raw("uuid_generate_v4()"));
                table.timestamp("start_date_time").notNullable();
                table.timestamp("end_date_time").notNullable();
                table.integer("duration").unsigned().notNullable();
              });
            }
            return;
          });
        })
        .then(() => {
          return knex.schema.hasTable("payments").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("payments", (table) => {
                table
                  .uuid("id")
                  .primary()
                  .defaultTo(knex.raw("uuid_generate_v4()"));

                table.uuid("user_id");
                table
                  .foreign("user_id")
                  .references("id")
                  .inTable("users")
                  .onDelete("SET NULL");

                table.string("stripe_session_id").notNullable();
                table.string("stripe_payment_intent_id");

                table
                  .enu("status", ["WAITING", "SUCCESS", "FAIL"], {
                    useNative: true,
                    enumName: "payment_status_type",
                  })
                  .defaultTo("WAITING");
                table.jsonb("processor_payload");
                table.specificType("total_fee", "NUMERIC(6, 2)").notNullable();
                table
                  .specificType("application_fee", "NUMERIC(6, 2)")
                  .notNullable();

                table
                  .timestamp("created_at", { precision: 0 })
                  .defaultTo(knex.fn.now(0))
                  .notNullable();
                table
                  .timestamp("updated_at", { precision: 0 })
                  .defaultTo(knex.fn.now(0))
                  .notNullable();
              });
            }
            return;
          });
        })
        .then(() => {
          return knex.schema.hasTable("events").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("events", (table) => {
                table
                  .uuid("id")
                  .primary()
                  .defaultTo(knex.raw("uuid_generate_v4()"));

                table.uuid("user_id");
                table
                  .foreign("user_id")
                  .references("id")
                  .inTable("users")
                  .onDelete("SET NULL");

                table.uuid("event_type_id");
                table
                  .foreign("event_type_id")
                  .references("id")
                  .inTable("event_types")
                  .onDelete("RESTRICT");

                table.uuid("payment_id").nullable();
                table
                  .foreign("payment_id")
                  .references("id")
                  .inTable("payments")
                  .onDelete("RESTRICT");

                table.uuid("event_schedule_id");
                table
                  .foreign("event_schedule_id")
                  .references("id")
                  .inTable("event_schedules")
                  .onDelete("RESTRICT");

                table.enu(
                  "status",
                  ["PENDING_PAYMENT", "ACTIVE", "CANCELLED", "FAILED_PAYMENT"],
                  { enumName: "event_status_type", useNative: true }
                );

                table.string("user_email").notNullable();
                table.string("invitee_email").notNullable();
                table.string("invitee_full_name").notNullable();

                table.string("user_timezone").notNullable();
                table.string("invitee_timezone").notNullable();

                table.string("location_value");

                table
                  .timestamp("created_at", { precision: 0 })
                  .defaultTo(knex.fn.now(0))
                  .notNullable();
                table.timestamp("cancelled_at", { precision: 0 });
              });
            }
            return;
          });
        })
        .then(() => {
          return knex.schema.hasTable("calendar_events").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("calendar_events", (table) => {
                table
                  .uuid("id")
                  .primary()
                  .defaultTo(knex.raw("uuid_generate_v4()"));

                table.uuid("user_id");
                table
                  .foreign("user_id")
                  .references("id")
                  .inTable("users")
                  .onDelete("SET NULL");

                table.uuid("event_id").nullable();
                table
                  .foreign("event_id")
                  .references("id")
                  .inTable("events")
                  .onDelete("CASCADE");

                table.uuid("event_schedule_id");
                table
                  .foreign("event_schedule_id")
                  .references("id")
                  .inTable("event_schedules")
                  .onDelete("RESTRICT");

                table.string("google_id").nullable();
                table.string("google_link").nullable();
              });
            }
          });
        })
        .then(() => {
          return knex.schema.hasTable("event_answers").then((exists) => {
            if (!exists) {
              return knex.schema.createTable("event_answers", (table) => {
                table
                  .uuid("id")
                  .primary()
                  .defaultTo(knex.raw("uuid_generate_v4()"));

                table.uuid("event_id");
                table
                  .foreign("event_id")
                  .references("id")
                  .inTable("events")
                  .onDelete("CASCADE");

                table.uuid("question_id");
                table
                  .foreign("question_id")
                  .references("id")
                  .inTable("event_type_questions")
                  .onDelete("RESTRICT");

                table.text("value").notNullable();
              });
            }
            return;
          });
        });
    });
}

export async function down(knex: Knex): Promise<void> {
  const types = [
    "provider_type",
    "location_type",
    "question_type",
    "payment_status_type",
    "event_status_type",
  ];
  const tables = [
    "stripe_accounts",
    "users",
    "oauth_connections",
    "schedules",
    "schedule_periods",
    "event_types",
    "event_type_questions",
    "event_type_question_possible_answers",
    "event_schedules",
    "payments",
    "events",
    "event_answers",
    "calendar_events",
  ];

  return Promise.all(
    types.map((type) => knex.raw(`DROP TYPE IF EXISTS ${type} CASCADE;`))
  )
    .then(() => {
      return Promise.all(
        tables.map((table) =>
          knex.raw(`DROP TABLE IF EXISTS ${table} CASCADE;`)
        )
      );
    })
    .then(() => {
      return;
    });
}
