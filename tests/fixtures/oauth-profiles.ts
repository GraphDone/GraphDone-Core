/**
 * OAuth Profile Test Fixtures
 *
 * Mock profile responses from OAuth providers matching their latest specs.
 * These fixtures are used for testing OAuth integration without real API calls.
 */

// Google OAuth 2.0 Profile
// Spec: https://developers.google.com/identity/protocols/oauth2/openid-connect#obtainuserinfo
export const GOOGLE_PROFILE_FIXTURE = {
  id: 'google_123456789012345678901',
  email: 'test.user@graphdone.com',
  verified_email: true,
  name: 'Test User',
  given_name: 'Test',
  family_name: 'User',
  picture: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
  locale: 'en',
  hd: 'graphdone.com' // Hosted domain (if G Suite user)
};

// Google OAuth Token Response
export const GOOGLE_TOKEN_FIXTURE = {
  access_token: 'ya29.mock_google_access_token',
  token_type: 'Bearer',
  expires_in: 3599,
  scope: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
  id_token: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Im1vY2sifQ.eyJpc3MiOiJodHRwczovL2FjY291bnRzLmdvb2dsZS5jb20iLCJzdWIiOiIxMjM0NTY3ODkwMTIzNDU2Nzg5MDEiLCJhenAiOiJtb2NrLWNsaWVudC1pZC5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSIsImF1ZCI6Im1vY2stY2xpZW50LWlkLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tIiwiaWF0IjoxNjk5OTk5OTk5LCJleHAiOjE3MDAwMDM1OTl9.mock_signature',
  refresh_token: 'mock_google_refresh_token'
};

// GitHub OAuth Profile
// Spec: https://docs.github.com/en/rest/users/users#get-the-authenticated-user
export const GITHUB_PROFILE_FIXTURE = {
  login: 'testuser',
  id: 98765432,
  node_id: 'MDQ6VXNlcjk4NzY1NDMy',
  avatar_url: 'https://avatars.githubusercontent.com/u/98765432?v=4',
  gravatar_id: '',
  url: 'https://api.github.com/users/testuser',
  html_url: 'https://github.com/testuser',
  type: 'User',
  site_admin: false,
  name: 'Test User',
  company: 'GraphDone',
  blog: 'https://graphdone.com',
  location: 'San Francisco, CA',
  email: 'testuser@graphdone.com',
  hireable: true,
  bio: 'Software developer and GraphDone contributor',
  twitter_username: 'testuser',
  public_repos: 42,
  public_gists: 5,
  followers: 100,
  following: 50,
  created_at: '2020-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
};

// GitHub OAuth Emails Response
// Spec: https://docs.github.com/en/rest/users/emails#list-email-addresses-for-the-authenticated-user
export const GITHUB_EMAILS_FIXTURE = [
  {
    email: 'testuser@graphdone.com',
    primary: true,
    verified: true,
    visibility: 'public'
  },
  {
    email: 'testuser@users.noreply.github.com',
    primary: false,
    verified: true,
    visibility: null
  }
];

// GitHub OAuth Token Response
export const GITHUB_TOKEN_FIXTURE = {
  access_token: 'gho_mock_github_token_XXXXXXXXXXXXXXXX',
  token_type: 'bearer',
  scope: 'user:email'
};

// LinkedIn OpenID Connect Profile
// Spec: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2#openid-connect-oidc
export const LINKEDIN_PROFILE_FIXTURE = {
  sub: 'linkedin_AbCdEfGhIjKlMnOp',  // Subject identifier
  name: 'Test User',
  given_name: 'Test',
  family_name: 'User',
  picture: 'https://media.licdn.com/dms/image/C5603AQE1234567890/profile-displayphoto-shrink_200_200/0',
  locale: 'en_US',
  email: 'testuser@graphdone.com',
  email_verified: true
};

// LinkedIn OIDC Token Response
export const LINKEDIN_TOKEN_FIXTURE = {
  access_token: 'mock_linkedin_access_token_XXXXXXXXXX',
  token_type: 'Bearer',
  expires_in: 5184000,  // 60 days
  scope: 'openid profile email',
  id_token: 'eyJhbGciOiJSUzI1NiIsImtpZCI6Im1vY2sifQ.eyJpc3MiOiJodHRwczovL3d3dy5saW5rZWRpbi5jb20vb2F1dGgiLCJzdWIiOiJBYkNkRWZHaElqS2xNbk9wIiwiYXVkIjoibW9jay1jbGllbnQtaWQiLCJpYXQiOjE2OTk5OTk5OTksImV4cCI6MTcwMDAwMzU5OSwibmFtZSI6IlRlc3QgVXNlciIsImVtYWlsIjoidGVzdHVzZXJAZ3JhcGhkb25lLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaWN0dXJlIjoiaHR0cHM6Ly9tZWRpYS5saW5rZWRpbi5jb20vZG1zL2ltYWdlL0M1NjAzQVFFMTIzNDU2Nzg5MC9wcm9maWxlLWRpc3BsYXlwaG90by1zaHJpbmtfMjAwXzIwMC8wIn0.mock_signature'
};

// LinkedIn OpenID Configuration (Discovery Document)
// Spec: https://openid.net/specs/openid-connect-discovery-1_0.html
export const LINKEDIN_OPENID_CONFIG_FIXTURE = {
  issuer: 'https://www.linkedin.com/oauth',
  authorization_endpoint: 'https://www.linkedin.com/oauth/v2/authorization',
  token_endpoint: 'https://www.linkedin.com/oauth/v2/accessToken',
  userinfo_endpoint: 'https://api.linkedin.com/v2/userinfo',
  jwks_uri: 'https://www.linkedin.com/oauth/openid/jwks',
  scopes_supported: ['openid', 'profile', 'email'],
  response_types_supported: ['code'],
  response_modes_supported: ['query'],
  grant_types_supported: ['authorization_code'],
  subject_types_supported: ['public'],
  id_token_signing_alg_values_supported: ['RS256'],
  claims_supported: ['sub', 'name', 'given_name', 'family_name', 'picture', 'email', 'email_verified', 'locale'],
  code_challenge_methods_supported: ['S256']
};

// Test users for different scenarios
export const OAUTH_TEST_USERS = {
  // Standard test user
  standard: {
    google: GOOGLE_PROFILE_FIXTURE,
    github: GITHUB_PROFILE_FIXTURE,
    linkedin: LINKEDIN_PROFILE_FIXTURE
  },

  // User with minimal profile data
  minimal: {
    google: {
      id: 'google_minimal_user',
      email: 'minimal@graphdone.com',
      verified_email: true,
      name: 'Min User'
    },
    github: {
      login: 'minuser',
      id: 11111111,
      avatar_url: 'https://avatars.githubusercontent.com/u/11111111?v=4',
      type: 'User',
      email: 'minimal@graphdone.com'
    },
    linkedin: {
      sub: 'linkedin_minimal',
      email: 'minimal@graphdone.com',
      email_verified: true
    }
  },

  // User without email (edge case)
  noEmail: {
    google: {
      id: 'google_no_email_user',
      verified_email: false,
      name: 'No Email User'
    },
    github: {
      login: 'noemailuser',
      id: 22222222,
      type: 'User'
    },
    linkedin: {
      sub: 'linkedin_no_email'
    }
  },

  // Enterprise/verified user
  enterprise: {
    google: {
      ...GOOGLE_PROFILE_FIXTURE,
      hd: 'enterprise.com'  // G Suite domain
    },
    github: {
      ...GITHUB_PROFILE_FIXTURE,
      company: 'Enterprise Corp',
      site_admin: false
    },
    linkedin: {
      ...LINKEDIN_PROFILE_FIXTURE,
      email_verified: true
    }
  }
};

// OAuth error responses for testing error handling
export const OAUTH_ERROR_FIXTURES = {
  google: {
    invalid_grant: {
      error: 'invalid_grant',
      error_description: 'Bad Request'
    },
    invalid_client: {
      error: 'invalid_client',
      error_description: 'The OAuth client was not found.'
    },
    unauthorized_client: {
      error: 'unauthorized_client',
      error_description: 'Client is unauthorized to retrieve access tokens using this method.'
    }
  },

  github: {
    bad_verification_code: {
      error: 'bad_verification_code',
      error_description: 'The code passed is incorrect or expired.'
    },
    redirect_uri_mismatch: {
      error: 'redirect_uri_mismatch',
      error_description: 'The redirect_uri MUST match the registered callback URL for this application.'
    },
    incorrect_client_credentials: {
      error: 'incorrect_client_credentials',
      error_description: 'The client_id and/or client_secret passed are incorrect.'
    }
  },

  linkedin: {
    invalid_grant: {
      error: 'invalid_grant',
      error_description: 'The provided authorization grant is invalid, expired, or revoked.'
    },
    invalid_client: {
      error: 'invalid_client',
      error_description: 'Client authentication failed.'
    },
    access_denied: {
      error: 'access_denied',
      error_description: 'The resource owner or authorization server denied the request.'
    }
  }
};

// OAuth state parameter examples for CSRF protection
export const OAUTH_STATE_FIXTURES = {
  valid: 'random_state_string_abcd1234',
  invalid: 'tampered_state_string',
  expired: 'expired_state_string_old'
};

// OAuth scopes for testing
export const OAUTH_SCOPES = {
  google: {
    minimal: ['profile', 'email'],
    extended: ['profile', 'email', 'openid']
  },
  github: {
    minimal: ['user:email'],
    extended: ['user:email', 'read:user', 'repo']
  },
  linkedin: {
    minimal: ['openid', 'profile', 'email'],
    extended: ['openid', 'profile', 'email', 'w_member_social']
  }
};
