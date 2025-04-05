import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { Logger, LogLevel } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  let logger: LogLevel[] = [
    "error",
    "warn",
    "debug",
    "fatal",
    "verbose",
    "log",
  ];
  if (process.env.NODE_ENV === "production") {
    logger = ["error", "warn", "fatal", "log"];
  }
  await app.listen(process.env.PORT || 3000);
  Logger.log(`Application started on port ${process.env.PORT || 3000}`);
}
bootstrap();
