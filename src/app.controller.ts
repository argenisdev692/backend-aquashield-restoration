import { Controller, Get, Redirect } from '@nestjs/common';

@Controller({ path: '' })
export class AppController {
  @Get()
  @Redirect('/api/docs', 301)
  redirectToDocs() {
    return {};
  }
}
