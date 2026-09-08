export class User {
  userId!: string;
  email!: string;
  fullName!: string;
  phoneNumber!: string | null;
  role!: string;
  isActive!: boolean;
  hasLogged!: boolean;
  identityProviderId!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
