import { Test, TestingModule } from '@nestjs/testing';
import { FlotaController } from './flota.controller';

describe('FlotaController', () => {
  let controller: FlotaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlotaController],
    }).compile();

    controller = module.get<FlotaController>(FlotaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
