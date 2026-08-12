import { Test, TestingModule } from '@nestjs/testing';
import { PasajesController } from './pasajes.controller';

describe('PasajesController', () => {
  let controller: PasajesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PasajesController],
    }).compile();

    controller = module.get<PasajesController>(PasajesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
