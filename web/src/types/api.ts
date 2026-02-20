/**
 * Request/response body types for auth API routes and external API calls.
 */

export type RegisterBody = {
   username: string;
   email: string;
   password: string;
};

export type ForgotPasswordBody = {
   email: string;
};

export type ResetPasswordBody = {
   token: string;
   password: string;
};

export type VerifyEmailBody = {
   token: string;
};

export type ApiErrorResponse = {
   error: string;
   code?: string;
};

export type ApiMessageResponse = {
   message?: string;
};
