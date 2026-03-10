import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1773132594053 implements MigrationInterface {
    name = 'AutoMigration1773132594053'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(120) NOT NULL, "slug" character varying(140) NOT NULL, "parentId" uuid, CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_420d9f679d41281f282f5bc7d0" ON "categories" ("slug") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8b0be371d28245da6e4f4b6187" ON "categories" ("name") `);
        await queryRunner.query(`CREATE TYPE "public"."registrations_status_enum" AS ENUM('pending', 'confirmed', 'cancelled', 'attended', 'waitlisted')`);
        await queryRunner.query(`CREATE TYPE "public"."registrations_paymentstatus_enum" AS ENUM('pending', 'paid', 'refunded', 'failed')`);
        await queryRunner.query(`CREATE TABLE "registrations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "registrationNumber" character varying(80) NOT NULL, "status" "public"."registrations_status_enum" NOT NULL DEFAULT 'pending', "cancellationDate" TIMESTAMP WITH TIME ZONE, "paymentStatus" "public"."registrations_paymentstatus_enum" NOT NULL DEFAULT 'pending', "paymentAmount" numeric(10,2) NOT NULL DEFAULT '0', "paymentMethod" character varying(50), "selectedPriceOption" jsonb, "checkInTime" TIMESTAMP WITH TIME ZONE, "metadata" jsonb, "qrCodeDataUrl" text, "waitlistPromotedAt" TIMESTAMP WITH TIME ZONE, "waitlistOfferExpiresAt" TIMESTAMP WITH TIME ZONE, "eventId" uuid, "userId" uuid, CONSTRAINT "PK_6013e724d7b22929da9cd7282d1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_133db113646ed250e71d661bc3" ON "registrations" ("eventId", "userId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_975a4bf2521a6772a70e11e700" ON "registrations" ("registrationNumber") `);
        await queryRunner.query(`CREATE TYPE "public"."events_status_enum" AS ENUM('draft', 'published', 'ongoing', 'completed', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "title" character varying(100) NOT NULL, "description" text NOT NULL, "slug" character varying(140) NOT NULL, "startDate" TIMESTAMP WITH TIME ZONE NOT NULL, "endDate" TIMESTAMP WITH TIME ZONE NOT NULL, "registrationDeadline" TIMESTAMP WITH TIME ZONE NOT NULL, "location" character varying(255) NOT NULL, "maxAttendees" integer NOT NULL DEFAULT '0', "currentRegistrations" integer NOT NULL DEFAULT '0', "status" "public"."events_status_enum" NOT NULL DEFAULT 'draft', "price" numeric(10,2) NOT NULL DEFAULT '0', "priceOptions" jsonb, "imageUrl" character varying(255), "metadata" jsonb, "cancellationPolicy" jsonb, "version" integer NOT NULL, "organizerId" uuid NOT NULL, CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2bf845a583ec9d8ccb4d9e71c5" ON "events" ("registrationDeadline") `);
        await queryRunner.query(`CREATE INDEX "IDX_d3c41688a81780a8d85f83dc5b" ON "events" ("status", "startDate") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_05bd884c03d3f424e2204bd14c" ON "events" ("slug") `);
        await queryRunner.query(`CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "tokenId" character varying(120) NOT NULL, "hashedToken" character varying(255) NOT NULL, "revoked" boolean NOT NULL DEFAULT false, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "userId" uuid, CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_48064cd66bef5bbbcc3eb19622" ON "refresh_tokens" ("tokenId") `);
        await queryRunner.query(`CREATE TABLE "profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "fullName" character varying(120) NOT NULL, "phone" character varying(30), "city" character varying(255), "organization" character varying(255), "bio" text, "avatarUrl" character varying(255), "userId" uuid, CONSTRAINT "REL_315ecd98bd1a42dcf2ec4e2e98" UNIQUE ("userId"), CONSTRAINT "PK_8e520eb4da7dc01d0e190447c8e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'organizer', 'participant')`);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'suspended')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying(255) NOT NULL, "password" character varying(255) NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'participant', "status" "public"."users_status_enum" NOT NULL DEFAULT 'active', "emailVerified" boolean NOT NULL DEFAULT false, "emailVerificationToken" character varying(255), "emailVerifiedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "system_settings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "key" character varying(120) NOT NULL, "value" jsonb NOT NULL, "description" text, CONSTRAINT "PK_82521f08790d248b2a80cc85d40" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b1b5bc664526d375c94ce9ad43" ON "system_settings" ("key") `);
        await queryRunner.query(`CREATE TYPE "public"."notification_templates_type_enum" AS ENUM('registration_confirmation', 'payment_confirmation', 'event_reminder', 'waitlist_confirmation', 'spot_available', 'cancellation_confirmation', 'event_changed')`);
        await queryRunner.query(`CREATE TABLE "notification_templates" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" "public"."notification_templates_type_enum" NOT NULL, "subjectTemplate" character varying(255) NOT NULL, "htmlTemplate" text NOT NULL, "textTemplate" text NOT NULL, "enabled" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_76f0fc48b8d057d2ae7f3a2848a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_39862b1a722590857df5d1b2e3" ON "notification_templates" ("type") `);
        await queryRunner.query(`CREATE TYPE "public"."notification_deliveries_type_enum" AS ENUM('registration_confirmation', 'payment_confirmation', 'event_reminder', 'waitlist_confirmation', 'spot_available', 'cancellation_confirmation', 'event_changed')`);
        await queryRunner.query(`CREATE TABLE "notification_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" "public"."notification_deliveries_type_enum" NOT NULL, "recipientEmail" character varying(255) NOT NULL, "subject" character varying(255) NOT NULL, "htmlBody" text NOT NULL, "textBody" text NOT NULL, "status" character varying(40) NOT NULL DEFAULT 'queued', "sentAt" TIMESTAMP WITH TIME ZONE, "failedAt" TIMESTAMP WITH TIME ZONE, "failureReason" text, "payload" jsonb, CONSTRAINT "PK_81daeff81f237bd384f7cfc4a4c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6eb4be409ff58f750b737fd9f7" ON "notification_deliveries" ("recipientEmail", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "idempotency_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "key" character varying(255) NOT NULL, "scope" character varying(120) NOT NULL, "userId" uuid, "requestHash" character varying(255) NOT NULL, "responseBody" jsonb, "statusCode" integer, "completed" boolean NOT NULL DEFAULT false, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "PK_8ad20779ad0411107a56e53d0f6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_15de2f76fa9f27ad8f33098360" ON "idempotency_keys" ("key", "scope") `);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "action" character varying(120) NOT NULL, "entity" character varying(120) NOT NULL, "actorUserId" uuid, "metadata" jsonb, CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_5c4e592ba7096b4c6a3b41354c" ON "audit_logs" ("actorUserId", "createdAt") `);
        await queryRunner.query(`CREATE TABLE "event_categories" ("eventsId" uuid NOT NULL, "categoriesId" uuid NOT NULL, CONSTRAINT "PK_50412a06819e29d69024e9a0aa0" PRIMARY KEY ("eventsId", "categoriesId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_46d665ff72b33bab59a6452231" ON "event_categories" ("eventsId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c39d545f7f624ec22f0691a5e2" ON "event_categories" ("categoriesId") `);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_9a6f051e66982b5f0318981bcaa" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "registrations" ADD CONSTRAINT "FK_06a49e76b60cac63e04b81eb1a9" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "registrations" ADD CONSTRAINT "FK_7e5ae7aa55bb98b8b9dcbe32ca3" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_1024d476207981d1c72232cf3ca" FOREIGN KEY ("organizerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "profiles" ADD CONSTRAINT "FK_315ecd98bd1a42dcf2ec4e2e985" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "event_categories" ADD CONSTRAINT "FK_46d665ff72b33bab59a64522314" FOREIGN KEY ("eventsId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "event_categories" ADD CONSTRAINT "FK_c39d545f7f624ec22f0691a5e29" FOREIGN KEY ("categoriesId") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "event_categories" DROP CONSTRAINT "FK_c39d545f7f624ec22f0691a5e29"`);
        await queryRunner.query(`ALTER TABLE "event_categories" DROP CONSTRAINT "FK_46d665ff72b33bab59a64522314"`);
        await queryRunner.query(`ALTER TABLE "profiles" DROP CONSTRAINT "FK_315ecd98bd1a42dcf2ec4e2e985"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_1024d476207981d1c72232cf3ca"`);
        await queryRunner.query(`ALTER TABLE "registrations" DROP CONSTRAINT "FK_7e5ae7aa55bb98b8b9dcbe32ca3"`);
        await queryRunner.query(`ALTER TABLE "registrations" DROP CONSTRAINT "FK_06a49e76b60cac63e04b81eb1a9"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_9a6f051e66982b5f0318981bcaa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c39d545f7f624ec22f0691a5e2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_46d665ff72b33bab59a6452231"`);
        await queryRunner.query(`DROP TABLE "event_categories"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5c4e592ba7096b4c6a3b41354c"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_15de2f76fa9f27ad8f33098360"`);
        await queryRunner.query(`DROP TABLE "idempotency_keys"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6eb4be409ff58f750b737fd9f7"`);
        await queryRunner.query(`DROP TABLE "notification_deliveries"`);
        await queryRunner.query(`DROP TYPE "public"."notification_deliveries_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_39862b1a722590857df5d1b2e3"`);
        await queryRunner.query(`DROP TABLE "notification_templates"`);
        await queryRunner.query(`DROP TYPE "public"."notification_templates_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b1b5bc664526d375c94ce9ad43"`);
        await queryRunner.query(`DROP TABLE "system_settings"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "profiles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_48064cd66bef5bbbcc3eb19622"`);
        await queryRunner.query(`DROP TABLE "refresh_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_05bd884c03d3f424e2204bd14c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d3c41688a81780a8d85f83dc5b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2bf845a583ec9d8ccb4d9e71c5"`);
        await queryRunner.query(`DROP TABLE "events"`);
        await queryRunner.query(`DROP TYPE "public"."events_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_975a4bf2521a6772a70e11e700"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_133db113646ed250e71d661bc3"`);
        await queryRunner.query(`DROP TABLE "registrations"`);
        await queryRunner.query(`DROP TYPE "public"."registrations_paymentstatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."registrations_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8b0be371d28245da6e4f4b6187"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_420d9f679d41281f282f5bc7d0"`);
        await queryRunner.query(`DROP TABLE "categories"`);
    }

}
