const graphQlTypeDefs = `

  enum AllowedBusinessType {
    individual,
    business
  }

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
    recentEventTypes: [UserEventType!]!       # returns 3 most recent updated/created event types
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

  input SchedulePeriodInput {
    day: Int!
    startTime: String!
    endTime: String!
  }

  type Schedule {
    timezone: String!
    periods: [SchedulePeriod!]!
  }

  input ScheduleInput {
    timezone: String!
    periods: [SchedulePeriodInput!]!
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

  input EventTypeLocationInput {
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
   
  type VisitorEventType {
    name: String!
    link: String!
    duration: Int!
    collectsPayments: Boolean!
    questions: [EventTypeQuestion!]!
    description: String
    paymentFee: Float
    availableDates(month: String!, timezone: String!): AvailableDates!
    availableTimes(date: String!, timezone: String!): AvailableDate!
  }

  type UserEventType {
    id: String!
    name: String!
    link: String!
    duration: Int!
    collectsPayments: Boolean!
    questions: [EventTypeQuestion!]!
    description: String
    paymentFee: Float
    isActive: Boolean!
    schedule: Schedule!
    location: EventTypeLocation!
    createdAt: String!
    updatedAt: String!
  }

  input EventTypeCreateInput {
    name: String!
    link: String!
    duration: Int!
    collectsPayments: Boolean!
    description: String
    paymentFee: Float
    questions: [EventTypeQuestionInput!]!
    schedule: ScheduleInput!
    location: EventTypeLocationInput!
  }

  input EventTypeUpdateInput {
    name: String
    duration: Int
    isActive: Boolean
    description: String
    location: EventTypeLocationInput
  }

  input EventTypeUpdatePaymentInput {
    collectsPayments: Boolean!
    paymentFee: Float
  }

  input EventTypeUpdateScheduleInput {
    schedule: ScheduleInput!
  }

  input EventTypeUpdateQuestionsInput {
    questions: [EventTypeQuestionInput!]!
  }

  type EventTypeConnections {
    pageInfo: PageInfo!
    edges: [UserEventType!]!
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

  input EventAnswerInput {
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
    date: String!
    startTime: String!
    answers: [EventAnswerInput!]!
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

  """
    Resolver related response types: 
      - CreateAccountResponse, LoginResponse, ConnectResponse, BookEventResponse
  """

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
    message: String!
  }

  type Query {
    me: User!
    viewBookingInformation(username: String!, eventTypeLink: String!): VisitorEventType!
    eventTypes(cursor: String = "", take: Int = 5, order: PaginationOrderType = DESC): EventTypeConnections!
    events(cursor: String = "", take: Int = 5, order: PaginationOrderType = DESC): EventConnections!
    payments(cursor: String = "", take: Int = 5, order: PaginationOrderType = DESC): PaymentConnections!
  }

  type Mutation {
    createAccount(params: UserCreateInput!): CreateAccountResponse!
    login(email: String!, password: String!): LoginResponse!
    toggle2Fa(activate: Boolean!): User!
    connectGoogleCalendar: ConnectResponse!
    connectStripe(businessType: AllowedBusinessType): ConnectResponse!
    createEventType(params: EventTypeCreateInput!): UserEventType!
    updateEventType(eventTypeId: String!, params: EventTypeUpdateInput!): UserEventType!
    updateEventTypeQuestions(eventTypeId: String!, params: EventTypeUpdateQuestionsInput!): UserEventType!
    updateEventTypeSchedule(eventTypeId: String!, params: EventTypeUpdateScheduleInput!): UserEventType!
    updateEventTypePayment(eventTypeId: String!, params: EventTypeUpdatePaymentInput!): UserEventType!
    deleteEventType(eventTypeId: String!): String!
    bookEvent(username: String!, eventTypeLink: String!, params: EventCreateInput!): BookEventResponse!
    updateEventTime(eventId: String!, params: EventUpdateTimeInput!): Event!
    cancelEvent(eventId: String!): Event!
  }
`;

export default graphQlTypeDefs;
