import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { RedisService } from '../cache/redis.service';
import { slugify } from '../common/utils/slug.util';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    private readonly redisService: RedisService,
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const slug = await this.createUniqueSlug(createCategoryDto.name);
    const parent = createCategoryDto.parentId
      ? await this.categoryRepository.findOne({
          where: { id: createCategoryDto.parentId },
        })
      : null;

    if (createCategoryDto.parentId && !parent) {
      throw new NotFoundException('Parent category not found.');
    }

    const category = this.categoryRepository.create({
      name: createCategoryDto.name,
      slug,
      parent,
    });

    const savedCategory = await this.categoryRepository.save(category);
    await this.redisService.delete('categories:list');
    return savedCategory;
  }

  async findAll() {
    const cached =
      await this.redisService.getJson<Category[]>('categories:list');

    if (cached) {
      return cached;
    }

    const categories = await this.categoryRepository.find({
      relations: { parent: true, children: true },
      order: { name: 'ASC' },
    });

    await this.redisService.setJson('categories:list', categories, 300);
    return categories;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: { parent: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found.');
    }

    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      category.name = updateCategoryDto.name;
      category.slug = await this.createUniqueSlug(updateCategoryDto.name, id);
    }

    if (updateCategoryDto.parentId !== undefined) {
      category.parent = updateCategoryDto.parentId
        ? await this.categoryRepository.findOne({
            where: { id: updateCategoryDto.parentId },
          })
        : null;
    }

    const savedCategory = await this.categoryRepository.save(category);
    await this.redisService.delete('categories:list');
    return savedCategory;
  }

  async remove(id: string) {
    const category = await this.categoryRepository.findOne({
      where: { id },
      relations: { events: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found.');
    }

    if (category.events.length > 0) {
      throw new ConflictException(
        'Cannot delete a category that is currently assigned to events.',
      );
    }

    await this.categoryRepository.remove(category);
    await this.redisService.delete('categories:list');
    return { message: 'Category deleted successfully.' };
  }

  private async createUniqueSlug(name: string, excludeId?: string) {
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.categoryRepository.findOne({
        where: excludeId ? { slug, id: Not(excludeId) } : { slug },
      });

      if (!existing) {
        return slug;
      }

      slug = `${baseSlug}-${counter}`;
      counter += 1;
    }
  }
}
