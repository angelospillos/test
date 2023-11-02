import * as Yup from 'yup';

import { valueNameValidator } from '~/utils/validators';

export const setVariableFormFields = {
  name: 'localVariableName',
};

export const setVariableSchema = Yup.object().shape({
  [setVariableFormFields.name]: valueNameValidator,
});
