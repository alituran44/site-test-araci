import {
  Controller, Get, Post, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditsService } from './audits.service';
import { CreateAuditDto, AuditFilterDto } from './dto/audit.dto';

@ApiTags('audits')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audits')
export class AuditsController {
  constructor(private auditsService: AuditsService) {}

  @Post()
  @ApiOperation({ summary: 'Start a new web audit' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateAuditDto) {
    return this.auditsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all audits for current user' })
  findAll(@CurrentUser('id') userId: string, @Query() filter: AuditFilterDto) {
    return this.auditsService.findAll(userId, filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get audit details and scores' })
  findOne(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.auditsService.findOne(id, userId);
  }

  @Get(':id/issues')
  @ApiOperation({ summary: 'Get issues for an audit (filterable)' })
  @ApiQuery({ name: 'module', required: false })
  @ApiQuery({ name: 'severity', required: false })
  getIssues(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Query('module') module?: string,
    @Query('severity') severity?: string,
  ) {
    return this.auditsService.getIssues(id, userId, module, severity);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an audit' })
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.auditsService.remove(id, userId);
  }
}
