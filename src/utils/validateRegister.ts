import { UserCredentials } from 'src/models/userCredentials';
import { createError } from './createValidationError';

export const validateRegister = (userCredentials: UserCredentials) => {
  if (userCredentials.username.length < 4) {
    return createError('username', 'username must contain at leat 4 characters');
  }

  if (userCredentials.password.length < 4) {
    return createError('password', 'password must contain at leat 4 characters');
  }

  if (userCredentials.email.length < 4) {
    return createError('email', 'email must contain at least 4 characters');
  }

  if (!userCredentials.email.includes('@') || !userCredentials.email.includes('.')) {
    return createError('email', 'Invalid email');
  }
  return null;
};
