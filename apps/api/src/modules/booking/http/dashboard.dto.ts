import { ApiProperty } from '@nestjs/swagger';
import { AdminBookingDto } from './bookings.dto';

export class DashboardNowDto {
  @ApiProperty({ description: 'Unpaid holds running right now.' })
  held!: number;
  @ApiProperty({ description: 'Paid, not yet handed over.' })
  confirmed!: number;
  @ApiProperty({ description: 'Handed over, not yet returned.' })
  active!: number;
  @ApiProperty({ description: 'Not returned by the end time.' })
  overdue!: number;
}

export class DashboardWindowDto {
  @ApiProperty()
  completed!: number;
  @ApiProperty()
  cancelled!: number;
  @ApiProperty()
  noShow!: number;
  @ApiProperty()
  expired!: number;
  @ApiProperty({ description: 'Payments received in the window, in paise.' })
  grossPaise!: number;
  @ApiProperty({ description: 'Refunds paid out in the window, in paise.' })
  refundedPaise!: number;
}

export class DashboardDto {
  @ApiProperty({ format: 'date-time' })
  generatedAt!: string;

  @ApiProperty({ description: 'Length of the "last days" window.' })
  windowDays!: number;

  @ApiProperty({ type: DashboardNowDto })
  now!: DashboardNowDto;

  @ApiProperty({ type: DashboardWindowDto })
  lastDays!: DashboardWindowDto;

  @ApiProperty({
    type: AdminBookingDto,
    isArray: true,
    description: 'The next confirmed bookings by start time.',
  })
  upcoming!: AdminBookingDto[];
}
