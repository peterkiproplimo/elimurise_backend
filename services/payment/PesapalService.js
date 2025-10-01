const axios = require('axios');
const https = require('https');

require('dotenv').config();
class Auth {
  constructor(consumerKey, consumerSecret) {
    this.consumer_key = consumerKey;
    this.consumer_secret = consumerSecret;
  }
}

class BillingAddress {
  constructor(
    emailAddress,
    phoneNumber,
    countryCode,
    firstName,
    middleName,
    lastName,
    line1,
    line2,
    city,
    state,
    postalCode,
    zipCode,
  ) {
    this.email_address = emailAddress;
    this.phone_number = phoneNumber;
    this.country_code = countryCode;
    this.first_name = firstName;
    this.middle_name = middleName;
    this.last_name = lastName;
    this.line_1 = line1;
    this.line_2 = line2;
    this.city = city;
    this.state = state;
    this.postal_code = postalCode;
    this.zip_code = zipCode;
  }
}

class Payment {
  constructor(id, currency, amount, notificationId, description, callbackUrl, billingAddress) {
    this.id = id;
    this.currency = currency;
    this.amount = amount;
    this.notification_id = notificationId;
    this.description = description;
    this.callback_url = callbackUrl;
    this.billing_address = billingAddress;
  }
}

class PesapalApiResponse {
  constructor(token, expiryDate, error, status, message) {
    this.token = token;
    this.expiryDate = expiryDate;
    this.error = error;
    this.status = status;
    this.message = message;
  }
}

class RegisterIPNRequest {
  constructor(url, ipnNotificationType) {
    this.url = url;
    this.ipn_notification_type = ipnNotificationType;
  }
}

class SubmitOrderResponse {
  constructor(orderTrackingId, merchantReference, redirectUrl, error, status) {
    this.order_tracking_id = orderTrackingId;
    this.merchant_reference = merchantReference;
    this.redirect_url = redirectUrl;
    this.error = error;
    this.status = status;
  }
}

class TokenResponse {
  constructor(token, expiryDate, error, status, message) {
    this.token = token;
    this.expiryDate = expiryDate;
    this.error = error;
    this.status = status;
    this.message = message;
  }
}

class TransactionResponse {
  constructor(
    paymentMethod,
    amount,
    createdDate,
    confirmationCode,
    orderTrackingId,
    paymentStatusDescription,
    description,
  ) {
    this.payment_method = paymentMethod;
    this.amount = amount;
    this.created_date = createdDate;
    this.confirmation_code = confirmationCode;
    this.order_tracking_id = orderTrackingId;
    this.payment_status_description = paymentStatusDescription;
    this.description = description;
  }
}

class PesapalApiService {
  constructor() {
    this.authUrl = process.env.PESAPAL_AUTH_URL;
    this.registerIPNUrl = process.env.PESAPAL_REGISTER_IPN_URL;
    this.submitOrderUrl = process.env.PESAPAL_SUBMIT_ORDER_URL;
    this.pesapalApiUrl = process.env.PESAPAL_API_URL;
    this.callbackUrl = process.env.PESAPAL_CALLBACK_URL;
    this.consumerKey = process.env.PESAPAL_CONSUMER_KEY;
    this.consumerSecret = process.env.PESAPAL_CONSUMER_SECRET;
    this.axiosInstance = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });
  }

  async requestToken() {
    try {
      const response = await this.axiosInstance.post(this.authUrl, new Auth(this.consumerKey, this.consumerSecret));
      const token = response.data.token;
      if (token) {
        console.log(token);
        return token;
      } else {
        throw new Error('Error in obtaining the bearer token');
      }
    } catch (error) {
      throw new Error('Failed to obtain bearer token from authentication API', error);
    }
  }

  async submitOrderRequest(orderRequest) {
    try {
      console.log(orderRequest);

      // Request token
      const bearerToken = await this.requestToken();

      // Set callback URL and add bearer token to headers
      orderRequest.callback_url = this.callbackUrl;
      orderRequest.redirect_mode = 'TOP_WINDOW';
      const headers = {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      };
      console.log(headers);
      console.log(this.submitOrderUrl);
      const request = new RegisterIPNRequest(orderRequest.callback_url, 'POST');
      const object = Object.assign({}, request);
      console.log(object);
      const ipn_details = await this.triggerRegisterIPNUrl(bearerToken, object);
      if (ipn_details) {
        orderRequest.notification_id = ipn_details.ipn_id;
        console.log(orderRequest);
        const response = await this.axiosInstance.post(this.submitOrderUrl, orderRequest, {headers});
        console.log(response);
        return response.data;
      } else {
        throw new Error('Failed to submit order request', error);
      }
      // Make order submission request
    } catch (error) {
      console.log(error);
      throw new Error('Failed to submit order request', error);
    }
  }

  async getTransactionStatus(orderTrackingId) {
    try {
      const bearerToken = await this.requestToken();

      // Set callback URL and add bearer token to headers
      const headers = {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      };
      const response = await this.axiosInstance.get(`${this.pesapalApiUrl}?orderTrackingId=${orderTrackingId}`, {
        headers,
      });
      return response.data;
    } catch (error) {
      console.log(error);
      throw new Error('Failed to retrieve transaction status', error);
    }
  }

  async triggerRegisterIPNUrl(token, registerIPNRequest) {
    try {
      // Set callback URL and add bearer token to headers
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
      const response = await this.axiosInstance.post(this.registerIPNUrl, registerIPNRequest, {headers});
      return response.data;
    } catch (error) {
      console.log(error);
      throw new Error('Failed to register callback url', error);
    }
  }
}

module.exports = {
  Auth,
  BillingAddress,
  Payment,
  PesapalApiResponse,
  RegisterIPNRequest,
  SubmitOrderResponse,
  TokenResponse,
  TransactionResponse,
  PesapalApiService,
};
