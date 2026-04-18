import { editDistance, fuzzyThreshold } from "./edit-distance.js";

export const AUTO_MAP_ALIASES = {
  // location_name
  name: "location_name",
  locationname: "location_name",
  businessname: "location_name",
  business: "location_name",
  company: "location_name",
  companyname: "location_name",
  placename: "location_name",
  place: "location_name",
  sitename: "location_name",
  storename: "location_name",
  brand: "location_name",
  brandname: "location_name",
  venue: "location_name",
  establishment: "location_name",
  dba: "location_name",
  tradename: "location_name",

  // street_address
  streetaddress: "street_address",
  street: "street_address",
  address: "street_address",
  addr: "street_address",
  address1: "street_address",
  addr1: "street_address",
  addressline1: "street_address",
  streetaddress1: "street_address",
  street1: "street_address",
  line1: "street_address",
  mailingaddress: "street_address",
  streetname: "street_address",
  fulladdress: "street_address",
  primaryaddress: "street_address",
  mainaddress: "street_address",
  road: "street_address",
  numberandstreet: "street_address",

  // city
  city: "city",
  cityname: "city",
  town: "city",
  township: "city",
  municipality: "city",
  locality: "city",
  village: "city",

  // region
  state: "region",
  statename: "region",
  statecode: "region",
  stateabbrev: "region",
  stateabbreviation: "region",
  region: "region",
  province: "region",
  provincename: "region",
  provincecode: "region",
  prov: "region",
  territory: "region",
  stateprovince: "region",
  stateterritory: "region",
  provinceorterritory: "region",
  provinceterritory: "region",
  county: "region",
  countyname: "region",
  adminarea: "region",
  administrativearea: "region",
  adminlevel1: "region",

  // postal_code
  zip: "postal_code",
  zipcode: "postal_code",
  zip5: "postal_code",
  zipcode5: "postal_code",
  zipplus4: "postal_code",
  postal: "postal_code",
  postalcode: "postal_code",
  postcode: "postal_code",
  postcodeuk: "postal_code",
  pincode: "postal_code",
  eircode: "postal_code",

  // latitude
  latitude: "latitude",
  lat: "latitude",
  latdd: "latitude",
  y: "latitude",
  ycoord: "latitude",
  ycoordinate: "latitude",

  // longitude
  longitude: "longitude",
  lng: "longitude",
  long: "longitude",
  lon: "longitude",
  lngdd: "longitude",
  londd: "longitude",
  x: "longitude",
  xcoord: "longitude",
  xcoordinate: "longitude",

  // iso_country_code
  country: "iso_country_code",
  countrycode: "iso_country_code",
  countryname: "iso_country_code",
  countryiso: "iso_country_code",
  isocountrycode: "iso_country_code",
  iso: "iso_country_code",
  iso2: "iso_country_code",
  iso3: "iso_country_code",
  iso3166: "iso_country_code",
  isoalpha2: "iso_country_code",
  cc: "iso_country_code",
  nation: "iso_country_code",
  nationcode: "iso_country_code",

  // phone_number
  phone: "phone_number",
  phonenumber: "phone_number",
  phonenum: "phone_number",
  tel: "phone_number",
  telephone: "phone_number",
  telephonenumber: "phone_number",
  contact: "phone_number",
  contactnumber: "phone_number",
  contactphone: "phone_number",
  mobile: "phone_number",
  cell: "phone_number",
  cellphone: "phone_number",

  // naics_code
  naics: "naics_code",
  naicscode: "naics_code",
  naicsindustry: "naics_code",
  industrycode: "naics_code",
  industry: "naics_code",

  // website
  website: "website",
  url: "website",
  web: "website",
  homepage: "website",
  webaddress: "website",
  weburl: "website",
  siteurl: "website",
  webpage: "website",
  domain: "website",

  // store_id
  storeid: "store_id",
  storenumber: "store_id",
  storeno: "store_id",
  locationid: "store_id",
  locationnumber: "store_id",
  siteid: "store_id",
  sitenumber: "store_id",
  branchid: "store_id",
  branchnumber: "store_id",
  unitid: "store_id",
  unitnumber: "store_id",
  outletid: "store_id",

  // mcc_code
  mcc: "mcc_code",
  mcccode: "mcc_code",
  merchantcategory: "mcc_code",
  merchantcategorycode: "mcc_code",
};

export function normalizeHeader(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[\s_\-./]+/g, "");
}

export function fuzzyMatchField(normalized, aliasMap) {
  const max = fuzzyThreshold(normalized.length);
  if (max === 0) return null;
  let bestDistance = max + 1;
  let bestField = null;
  for (const aliasKey of Object.keys(aliasMap)) {
    if (Math.abs(aliasKey.length - normalized.length) > max) continue;
    const d = editDistance(normalized, aliasKey);
    if (d < bestDistance) {
      bestDistance = d;
      bestField = aliasMap[aliasKey];
    }
  }
  return bestField;
}

export function computeAutomap(headers, learnedAliases = {}) {
  const automap = {};
  for (const header of headers) {
    if (!header) continue;
    const key = normalizeHeader(header);
    const fieldId = learnedAliases[key] || AUTO_MAP_ALIASES[key] || fuzzyMatchField(key, learnedAliases) || fuzzyMatchField(key, AUTO_MAP_ALIASES);
    if (fieldId && !automap[fieldId]) {
      automap[fieldId] = header;
    }
  }
  return automap;
}
