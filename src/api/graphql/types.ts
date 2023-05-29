const graphQlTypeDefs = `
  type User {
    username: String!
    email: String!
    fullName: String!                         # requires field resolver (first + last)
    isVerified: Boolean!
    is2FaActivated: Boolean!    
    createdAt: String!
    recentPayments: [Payment!]!               # returns 3 most recent received payments
    recentEventTypes: [EventType!]!           # returns 3 most recent updated/created event types
    upcomingEvents: [Event!]!                 # returns 3 nearest upcoming events
  }

  input UserCreateInput {
    username: String!
    email: String!
    password: String!
    firstName: String!
    lastName: String!
  }

  type SchedulePeriod {
    day: Int!
    startTime: String!
    endTime: String!
  }

  type Schedule {
    timezone: String!
    periods: [SchedulePeriod!]!
  }

  enum QuestionType {
    TEXT,
    RADIO,
    CHECKBOX
  }

  type EventTypeQuestion {
    type: QuestionType!
    label: String!
    isOptional: Boolean!
    possibleAnswers: [String!]
  }

  enum LocationType {
    G_MEET,
    PHONE,
    ADDRESS
  }
  type EventTypeLocation {
    type: LocationType!
    value: String
  }

  type AvailableTimeSlot {
    startTime: String!
    endTime: String!
  }
  
  type AvailableDate {
    date: String!
    times: [AvailableTimeSlot!]!
  }
  
  type AvailableDates {
    month: String!
    timezone: String!
    dates: [AvailableDate!]!
  }
   
  interface EventType {
    name: String!
    link: String!
    duration: Int!
    collectsPayments: Boolean!
    questions: [EventTypeQuestion!]!
    description: String
    paymentFee: Float
  }

  type VisitorEventType implements EventType {
    availableDates(month: String!, timezone: String!): AvailableDates!
    availableTimes(date: String!, timezone: String!): AvailableDate!
  }

  type UserEventType implements EventType {
    id: String!
    schedule: Schedule!
    isActive: Boolean!
    location: EventTypeLocation!
  }

  input EventTypeCreateInput {
    name: String!
    link: String!
    duration: Int!
    collectsPayments: Boolean!
    description: String
    paymentFee: Float
    questions: [EventTypeQuestion!]!
    schedule: Schedule!
    location: EventTypeLocation!
  }

  input EventTypeUpdateInput {
    name: String
    duration: Int
    isActive: Boolean
    description: String
    location: EventTypeLocation
  }

  input EventTypeUpdatePaymentInput {
    collectsPayments: Boolean!
    paymentFee: Float
  }

  input EventTypeUpdateScheduleInput {
    schedule: Schedule!
  }

  input EventTypeUpdateQuestionsInput {
    questions: [EventTypeQuestion!]!
  }

  type EventAnswer {
    question: EventTypeQuestion!
    answer: [String!]!
  }

  enum EventStatusType {
    PENDING_PAYMENT,
    ACTIVE,
    CANCELLED,
    FAILED_PAYMENT
  }
  type Event {
    id: String!
    status: EventStatusType!
    inviteeEmail: String!
    inviteeFullName: String!
    startDateTime: String!
    endDateTime: String!
    locationValue: String!
    payment: Payment
    answers: [EventAnswer!]!
    createdAt: String!
    cancelledAt: String
  }

  input EventCreateInput {
    inviteeEmail: String!
    inviteeFullName: String!
    startDateTime: String!
    endDateTime: String!
    answers: [EventAnswer!]!
    visitorTimezone: String!
  }

  input EventUpdateTimeInput {
    startDateTime: String!
    endDateTime: String!
  }

  enum PaymentStatus {
    WAITING,
    SUCCESS,
    FAIL
  }
  type Payment {
    id: String!
    status: PaymentStatus!
    payload: String!
    createdAt: String!
    updatedAt: String!
  }

  enum PaginationOrder {
    ASC,
    DESC
  }

  type PageInfo {
    nextPage: String
    previousPage: String
    order: PaginationOrder!
    take: Int!
  }

  type EventTypeConnections {
    pageInfo: PageInfo!
    edges: [EventType!]!
  }

  type EventConnections {
    pageInfo: PageInfo!
    edges: [Event!]!
  }

  type PaymentConnections {
    info: PageInfo!
    edges: [Payment!]!
  }
  
  type CreateAccountResponse {
    message: String!
  }

  type LoginResponse {
    message: String!
    is2FaActivated: Boolean!
  }

  type ConnectResponse {
    message: String!
    redirect: String!
  }

  type BookEventResponse {
    message: string!
  }

  type Query {
    me(): User!
    viewBookingInformation(username: String!, eventTypeLink: String!): VisitorEventType!
    eventTypes(after: String = "", take: Int = 5, order: PaginationOrder = "DESC"): EventTypeConnections!
    events(after: String = "", take: Int = 5, order: PaginationOrder = "DESC"): EventConnections!
    payments(after: String = "", take: Int = 5, order: PaginationOrder = "DESC"): PaymentConnections!
  }

  type Mutation {
    createAccount(params: UserCreateInput!): CreateAccountResponse!
    login(email: String!, password: String!): LoginResponse!
    activate2Fa(): User!
    connectGoogleCalendar(): ConnectResponse!
    connectStripe(): ConnectResponse!
    createEventType(params: EventTypeCreateInput!): EventType!
    updateEventType(eventTypeId: String!, params: EventTypeUpdateInput!): EventType!
    updateEventTypeQuestions(eventTypeId: String!, params: EventTypeUpdateQuestionsInput!): EventType!
    updateEventTypeSchedule(eventTypeId: String!, params: EventTypeUpdateScheduleInput!): EventType!
    updateEventTypePayment(eventTypeId: String!, params: EventTypeUpdatePaymentInput!): EventType!
    deleteEventType(eventTypeId: String!): EventType!
    bookEvent(params: EventCreateInput!): BookEventResponse!
    cancelEvent(eventId: String!): Event!
    deleteEvent(eventId: String!): Event!
  }
`;

export default graphQlTypeDefs;
