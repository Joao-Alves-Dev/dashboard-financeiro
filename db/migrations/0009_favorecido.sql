ALTER TABLE "lancamentos" ADD COLUMN "favorecido" text;--> statement-breakpoint
ALTER TABLE "lancamentos" ADD COLUMN "favorecido_chave" text;--> statement-breakpoint
CREATE INDEX "lancamentos_workspace_favorecido_data_idx" ON "lancamentos" USING btree ("workspace_id","favorecido_chave","data");--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_favorecido_check" CHECK ("lancamentos"."favorecido" is null or char_length("lancamentos"."favorecido") between 1 and 80);--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_favorecido_chave_check" CHECK ("lancamentos"."favorecido_chave" is null or char_length("lancamentos"."favorecido_chave") between 1 and 80);--> statement-breakpoint
ALTER TABLE "lancamentos" ADD CONSTRAINT "lancamentos_favorecido_consistente_check" CHECK (("lancamentos"."favorecido" is null) = ("lancamentos"."favorecido_chave" is null));