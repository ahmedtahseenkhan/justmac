import { Body, Controller, Post } from "@nestjs/common";
import { quoteRequestSchema, type QuoteRequest } from "@sellme/shared";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { QuoteService } from "./quote.service";

@Controller("quote")
export class QuoteController {
  constructor(private readonly quote: QuoteService) {}

  @Post()
  create(@Body(new ZodValidationPipe(quoteRequestSchema)) body: QuoteRequest) {
    return this.quote.createQuote(body);
  }
}
