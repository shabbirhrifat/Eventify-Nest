import { EventStatus } from '../../common/enums/event-status.enum';

export interface EventListItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  startDate: Date;
  endDate: Date;
  registrationDeadline: Date;
  location: string;
  maxAttendees: number;
  currentRegistrations: number;
  status: EventStatus;
  price: string;
  imageUrl: string | null;
  categories: Array<{ id: string; name: string; slug: string }>;
  organizer: { id: string; email: string; fullName: string };
  isFull: boolean;
  registrationOpen: boolean;
  isRegistered?: boolean;
}
