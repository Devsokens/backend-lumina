import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { FinanceModule } from '../finance/finance.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [FinanceModule, OrganizationsModule],
  providers: [AiService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}
