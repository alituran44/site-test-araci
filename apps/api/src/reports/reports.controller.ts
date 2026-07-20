import { Controller, Get, Param, Res, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  private reportDir = path.join(process.cwd(), 'public', 'reports');

  constructor(private prisma: PrismaService) {}

  @Get(':auditId/pdf')
  @ApiOperation({ summary: 'Download PDF audit report' })
  async downloadPdf(@Param('auditId') auditId: string, @Res() res: Response) {
    const filename = `${auditId}.pdf`;
    const filepath = path.join(this.reportDir, filename);

    if (!fs.existsSync(filepath)) {
      throw new NotFoundException('PDF Report not generated yet');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="webaudit-report-${auditId}.pdf"`);
    res.sendFile(filepath);
  }

  @Get(':auditId/csv')
  @ApiOperation({ summary: 'Download CSV issues list' })
  async downloadCsv(@Param('auditId') auditId: string, @Res() res: Response) {
    const filename = `${auditId}.csv`;
    const filepath = path.join(this.reportDir, filename);

    if (!fs.existsSync(filepath)) {
      throw new NotFoundException('CSV Report not generated yet');
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="webaudit-issues-${auditId}.csv"`);
    res.sendFile(filepath);
  }

  @Get(':auditId/json')
  @ApiOperation({ summary: 'Download JSON raw audit payload' })
  async downloadJson(@Param('auditId') auditId: string, @Res() res: Response) {
    const filename = `${auditId}.json`;
    const filepath = path.join(this.reportDir, filename);

    if (!fs.existsSync(filepath)) {
      throw new NotFoundException('JSON Report not generated yet');
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="webaudit-raw-${auditId}.json"`);
    res.sendFile(filepath);
  }

  @Get(':auditId/html')
  @ApiOperation({ summary: 'View HTML formatted report' })
  async viewHtml(@Param('auditId') auditId: string, @Res() res: Response) {
    const filename = `${auditId}.html`;
    const filepath = path.join(this.reportDir, filename);

    if (!fs.existsSync(filepath)) {
      throw new NotFoundException('HTML Report not generated yet');
    }

    res.setHeader('Content-Type', 'text/html');
    res.sendFile(filepath);
  }
}
