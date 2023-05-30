const graphQlTypeDefs = `

  enum PaginationOrderType {
    ASC,
    DESC
  }

  type PageInfo {
    nextPage: String
    previousPage: String
    order: PaginationOrderType!
    take: Int!
  }

  """
    User related types/inputs: User, UserCreateInput
  """

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

  """
    EventType related types/inputs/enums: 
      - SchedulePeriod, Schedule
      - QuestionType, EventTypeQuestion, EventTypeQuestionInput
      - LocationType, EventTypeLocation
      - AvailableTimeSlot, AvailableDate, AvailableDates
      - EventType, VisitorEventType, UserEventType
      - EventTypeCreateInput, EventTypeUpdateInput
      - EventTypeUpdateScheduleInput, EventTypeUpdatePaymentInput, EventTypeUpdateQuestionsInput
      - EventTypeConnections
  """

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
    id: String!
    type: QuestionType!
    label: String!
    isOptional: Boolean!
    possibleAnswers: [String!]
  }

  input EventTypeQuestionInput {
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
    questions: [EventTypeQuestionInput!]!
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
    questions: [EventTypeQuestionInput!]!
  }

  type EventTypeConnections {
    pageInfo: PageInfo!
    edges: [EventType!]!
  }

  """
    Event related types/inputs:
      - EventAnswer, EventStatusType
      - Event
      - EventCreateInput
      - EventUpdateTimeInput
      - EventConnections
  """

  type EventAnswer {
    questionId: String!
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
    inviteeTimezone: String!
    startDateTime: String!
    endDateTime: String!
    answers: [EventAnswer!]!
  }

  input EventUpdateTimeInput {
    startDateTime: String!
    endDateTime: String!
  }

  type EventConnections {
    pageInfo: PageInfo!
    edges: [Event!]!
  }

  """
    Payment related types/inputs: PaymentStatusType, Payment, PaymentConnections
  """

  enum PaymentStatusType {
    WAITING,
    SUCCESS,
    FAIL
  }

  type Payment {
    id: String!
    status: PaymentStatusType!
    payload: String!
    createdAt: String!
    updatedAt: String!
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
    bookEvent(username: String!, eventTypeLink: String!, params: EventCreateInput!): BookEventResponse!
    updateEventTime(eventId: String!, params: EventUpdateTimeInput!): Event!
    cancelEvent(eventId: String!): Event!
  }
`;

export default graphQlTypeDefs;
