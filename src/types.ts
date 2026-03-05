// --- Addresses ---

export interface PostNLAddress {
  AddressType: string;
  City: string;
  CompanyName?: string;
  Countrycode: string;
  HouseNr: string;
  HouseNrExt?: string;
  Street: string;
  Zipcode: string;
  FirstName?: string;
  Name?: string;
  Area?: string;
  Buildingname?: string;
  Department?: string;
  Doorcode?: string;
  Floor?: string;
  Region?: string;
  Remark?: string;
}

// --- Contacts ---

export interface PostNLContact {
  ContactType: string;
  Email?: string;
  SMSNr?: string;
  TelNr?: string;
}

// --- Amounts ---

export interface PostNLAmount {
  AmountType: string;
  AccountName?: string;
  BIC?: string;
  Currency?: string;
  IBAN?: string;
  Reference?: string;
  TransactionNumber?: string;
  Value?: string;
}

// --- Customs ---

export interface PostNLCustomsContent {
  Description: string;
  Quantity: number;
  Weight: number;
  Value: number;
  HSTariffNr?: string;
  CountryOfOrigin?: string;
}

export interface PostNLCustoms {
  Certificate?: boolean;
  CertificateNr?: string;
  Currency?: string;
  HandleAsNonDeliverable?: boolean;
  Invoice?: boolean;
  InvoiceNr?: string;
  License?: boolean;
  LicenseNr?: string;
  ShipmentType?: string;
  Content?: PostNLCustomsContent[];
}

// --- Dimension ---

export interface PostNLDimension {
  Height?: number;
  Length?: number;
  Volume?: number;
  Weight?: number;
  Width?: number;
}

// --- Product Options ---

export interface PostNLProductOption {
  Characteristic: string;
  Option: string;
}

// --- Shipment ---

export interface PostNLShipmentRequest {
  Addresses: PostNLAddress[];
  Barcode: string;
  Contacts?: PostNLContact[];
  DeliveryAddress?: string;
  Dimension?: PostNLDimension;
  ProductCodeDelivery: string;
  ProductOptions?: PostNLProductOption[];
  Reference?: string;
  Remark?: string;
  ReturnBarcode?: string;
  ReturnReference?: string;
  Amounts?: PostNLAmount[];
  CodingText?: string;
  CollectionTimeStampStart?: string;
  CollectionTimeStampEnd?: string;
  Content?: string;
  CostCenter?: string;
  CustomerOrderNumber?: string;
  Customs?: PostNLCustoms;
  DeliveryDate?: string;
  DeliveryTimeStampStart?: string;
  DeliveryTimeStampEnd?: string;
  DownPartnerBarcode?: string;
  DownPartnerID?: string;
  DownPartnerLocation?: string;
  Groups?: PostNLGroup[];
  IDExpiration?: string;
  IDNumber?: string;
  IDType?: string;
  ReceiverDateOfBirth?: string;
}

export interface PostNLGroup {
  GroupCount?: number;
  GroupSequence?: number;
  GroupType?: string;
  MainBarcode?: string;
}

export interface PostNLShipmentBody {
  Customer: PostNLCustomer;
  Message: PostNLMessage;
  Shipments: PostNLShipmentRequest[];
}

export interface PostNLCustomer {
  Address?: PostNLAddress;
  CollectionLocation?: string;
  ContactPerson?: string;
  CustomerCode: string;
  CustomerNumber: string;
  Email?: string;
  Name?: string;
}

export interface PostNLMessage {
  MessageID: string;
  MessageTimeStamp: string;
  Printertype: string;
}

// --- Shipment Response ---

export interface PostNLShipmentResponse {
  MergedLabels?: PostNLLabel[];
  ResponseShipments?: PostNLResponseShipment[];
}

export interface PostNLResponseShipment {
  Barcode?: string;
  DownPartnerBarcode?: string;
  DownPartnerID?: string;
  DownPartnerLocation?: string;
  Errors?: PostNLError[];
  Labels?: PostNLLabel[];
  ProductCodeDelivery?: string;
  Warnings?: PostNLWarning[];
}

export interface PostNLLabel {
  Content?: string;
  Labeltype?: string;
  OutputType?: string;
}

export interface PostNLError {
  Code?: string;
  Description?: string;
}

export interface PostNLWarning {
  Code?: string;
  Description?: string;
}

// --- Barcode ---

export interface PostNLBarcodeResponse {
  Barcode: string;
}

// --- Status / Tracking ---

export interface PostNLStatusResponse {
  CurrentStatus?: PostNLCurrentStatus;
  Warnings?: PostNLWarning[];
}

export interface PostNLCurrentStatus {
  Shipment?: PostNLShipmentStatus;
}

export interface PostNLShipmentStatus {
  Addresses?: PostNLAddress[];
  Amounts?: PostNLAmount[];
  Barcode?: string;
  DeliveryDate?: string;
  Dimension?: PostNLDimension;
  ExpectedDeliveryDate?: string;
  ExpectedDeliveryTimeStampStart?: string;
  ExpectedDeliveryTimeStampEnd?: string;
  Groups?: PostNLGroup[];
  MainBarcode?: string;
  ProductCode?: string;
  ProductDescription?: string;
  ProductOptions?: PostNLProductOption[];
  Reference?: string;
  Status?: PostNLStatus;
  OldStatuses?: PostNLOldStatus[];
  Warnings?: PostNLWarning[];
}

export interface PostNLStatus {
  TimeStamp?: string;
  StatusCode?: string;
  StatusDescription?: string;
  PhaseCode?: string;
  PhaseDescription?: string;
}

export interface PostNLOldStatus {
  TimeStamp?: string;
  StatusCode?: string;
  StatusDescription?: string;
  PhaseCode?: string;
  PhaseDescription?: string;
}

// --- Delivery Date ---

export interface PostNLDeliveryDateRequest {
  ShippingDate: string;
  ShippingDuration?: number;
  CutOffTime?: string;
  PostalCode: string;
  CountryCode?: string;
  OriginCountryCode?: string;
  City?: string;
  Street?: string;
  HouseNr?: string;
  HouseNrExt?: string;
  Options?: string[];
}

export interface PostNLDeliveryDateResponse {
  DeliveryDate: string;
  Options?: PostNLDeliveryOption;
}

export interface PostNLDeliveryOption {
  string?: string;
}

// --- Delivery Options / Timeframes ---

export interface PostNLTimeframeRequest {
  StartDate: string;
  EndDate: string;
  PostalCode: string;
  CountryCode?: string;
  HouseNumber?: number;
  HouseNrExt?: string;
  City?: string;
  Street?: string;
  AllowSundaySorting?: boolean;
  Options?: string[];
}

export interface PostNLTimeframeResponse {
  Timeframes?: PostNLTimeframes;
  ReasonNoTimeframes?: PostNLReasonNoTimeframe;
}

export interface PostNLTimeframes {
  Timeframe?: PostNLTimeframe[];
}

export interface PostNLTimeframe {
  Date?: string;
  Timeframes?: PostNLTimeframeDetail;
}

export interface PostNLTimeframeDetail {
  TimeframeTimeframe?: PostNLTimeframeTimeFrame[];
}

export interface PostNLTimeframeTimeFrame {
  From?: string;
  To?: string;
  Options?: PostNLTimeframeOptions;
}

export interface PostNLTimeframeOptions {
  string?: string[];
}

export interface PostNLReasonNoTimeframe {
  ReasonNoTimeframe?: PostNLReasonNoTimeframeDetail[];
}

export interface PostNLReasonNoTimeframeDetail {
  Code?: string;
  Date?: string;
  Description?: string;
  Options?: PostNLTimeframeOptions;
}

// --- Locations ---

export interface PostNLLocationRequest {
  CountryCode: string;
  PostalCode?: string;
  City?: string;
  Street?: string;
  HouseNumber?: number;
  DeliveryDate?: string;
  OpeningTime?: string;
  DeliveryOptions?: string[];
  Latitude?: number;
  Longitude?: number;
}

export interface PostNLLocationsResponse {
  GetLocationsResult?: PostNLGetLocationsResult;
}

export interface PostNLGetLocationsResult {
  ResponseLocation?: PostNLLocation[];
}

export interface PostNLLocation {
  Address?: PostNLLocationAddress;
  DeliveryOptions?: PostNLLocationDeliveryOptions;
  Distance?: number;
  Latitude?: number;
  LocationCode?: number;
  Longitude?: number;
  Name?: string;
  OpeningHours?: PostNLOpeningHours;
  PhoneNumber?: string;
  RetailNetworkID?: string;
  Saleschannel?: string;
  TerminalType?: string;
  PartnerName?: string;
}

export interface PostNLLocationAddress {
  City?: string;
  Countrycode?: string;
  HouseNr?: number;
  HouseNrExt?: string;
  Remark?: string;
  Street?: string;
  Zipcode?: string;
}

export interface PostNLLocationDeliveryOptions {
  string?: string[];
}

export interface PostNLOpeningHours {
  Monday?: PostNLOpeningHoursDay;
  Tuesday?: PostNLOpeningHoursDay;
  Wednesday?: PostNLOpeningHoursDay;
  Thursday?: PostNLOpeningHoursDay;
  Friday?: PostNLOpeningHoursDay;
  Saturday?: PostNLOpeningHoursDay;
  Sunday?: PostNLOpeningHoursDay;
}

export interface PostNLOpeningHoursDay {
  string?: string;
}

export interface PostNLSingleLocationResponse {
  GetLocationsResult?: PostNLGetLocationsResult;
}

// --- Address Validation ---

export interface PostNLAddressCheckRequest {
  PostalCode: string;
  HouseNumber: number;
  HouseNumberAddition?: string;
}

export interface PostNLAddressCheckResponse {
  city?: string;
  postalCode?: string;
  streetName?: string;
  houseNumber?: number;
  houseNumberAddition?: string;
  formattedAddress?: string[];
}
