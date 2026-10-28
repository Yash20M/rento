import { applyDecorators } from '@nestjs/common';
import { IsISO8601, Matches } from 'class-validator';

/** A calendar instant with an explicit UTC offset, e.g. `2030-01-07T04:00:00Z` (a date without an offset is ambiguous). */
export const IsInstant = () =>
  applyDecorators(
    IsISO8601({ strict: true }),
    Matches(/(Z|[+-]\d{2}:\d{2})$/, {
      message: 'include the UTC offset, for example 2030-01-07T04:00:00Z',
    }),
  );
