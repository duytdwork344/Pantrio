import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

class HealthResponseDto {
  @ApiProperty()
  status!: string;

  @ApiProperty()
  service!: string;

  @ApiProperty()
  timestamp!: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({ type: HealthResponseDto })
  check(): HealthResponseDto {
    return {
      status: 'ok',
      service: 'pantrio-api',
      timestamp: new Date().toISOString(),
    };
  }
}
