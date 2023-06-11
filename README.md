## Calendar Booking System

**Description:** The backend app connects to your Google Calendar and allows you to define and share event types invitees can access to book meetings, based on the rules you defined and the availability in your calendar.

The backend app uses Stripe Connect to process one-time payments on behalf of its users and to then transfer those funds into users' associated Stripe accounts.

**Technologies:** Express, GraphQL, Typescript, PostgreSQL, Knex.js, Stripe Node.js Library

### Features

- [x] the user can create an account using an email and a password
- [x] the user's email address is verified using a verification link
- [x] the user can activate email 2 factor-authentication to protect his account
- [x] the user can sync his Google Calendar account
- [x] the user can CRUD 1-to-1 event types
- [x] the user can CRUD past and upcoming events, payments, event types
- [x] the invitee can book an event which fits within the event type's scheduling rules and the user's calendars free time slots
- [x] the invitee can cancel his event by accessing his event cancellation link attached in the event confirmation mail
- [x] the invitee receives a confirmation mail after booking an event
- [x] the invitee receives a cancellation mail after the owner cancels the event
- [x] the user can require one-off payments from his invitees to book an event based off a particular event type
