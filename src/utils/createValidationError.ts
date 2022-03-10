export const createError = (field: string, message: string) => {
  return {
    errors: [{ field, message }],
  };
};
