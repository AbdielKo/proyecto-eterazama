import { Test, TestingModule } from '@nestjs/testing';
import { FlotaService } from './flota.service';

describe('FlotaService', () => {
  let service: FlotaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FlotaService],
    }).compile();

    service = module.get<FlotaService>(FlotaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
