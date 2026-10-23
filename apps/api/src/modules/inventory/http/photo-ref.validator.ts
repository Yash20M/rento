import { type ValidationOptions, isURL, registerDecorator } from 'class-validator';
import { mediaIdOf } from '../domain/images';

/** A photo is either an https URL or the path of a photo uploaded to this API (`/v1/media/<id>`). */
export function IsPhotoRef(options?: ValidationOptions) {
  return (target: object, propertyName: string): void =>
    registerDecorator({
      name: 'isPhotoRef',
      target: target.constructor,
      propertyName,
      ...(options && { options }),
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' &&
          (mediaIdOf(value) !== undefined ||
            isURL(value, { protocols: ['https'], require_protocol: true, require_tld: false })),
        defaultMessage: () => 'each photo must be an https URL or an uploaded photo',
      },
    });
}
