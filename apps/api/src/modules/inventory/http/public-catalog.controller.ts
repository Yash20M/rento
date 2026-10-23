import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { problem, uuidParam } from '../../../common/http/problem-response';
import { itemModelNotFound } from '../domain/inventory-errors';
import { CategoryService } from '../services/category.service';
import { ItemModelService } from '../services/item-model.service';
import { categoryView, itemModelView } from './admin-inventory.controllers';
import { CategoryDto, ItemModelDto, ItemModelQuery } from './inventory.dto';

/** What customers browse: no sign-in needed, deactivated models are invisible. */
@ApiTags('catalog')
@Controller()
export class PublicCatalogController {
  constructor(
    private readonly categories: CategoryService,
    private readonly models: ItemModelService,
  ) {}

  @Get('categories')
  @ApiOkResponse({ type: CategoryDto, isArray: true })
  async listCategories(): Promise<CategoryDto[]> {
    return (await this.categories.list()).map((c) => categoryView(c));
  }

  @Get('item-models')
  @ApiOkResponse({ type: ItemModelDto, isArray: true, description: 'Active models only.' })
  async listModels(@Query() query: ItemModelQuery): Promise<ItemModelDto[]> {
    const rows = await this.models.list({ categoryId: query.categoryId, includeInactive: false });
    return rows.map(itemModelView);
  }

  @Get('item-models/:id')
  @ApiOkResponse({ type: ItemModelDto })
  @problem(404, '`NOT_FOUND` — unknown or deactivated model.')
  async getModel(@Param('id', uuidParam(itemModelNotFound)) id: string): Promise<ItemModelDto> {
    const model = await this.models.get(id);
    if (model.status !== 'active') throw itemModelNotFound();
    return itemModelView(model);
  }
}
