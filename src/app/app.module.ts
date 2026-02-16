import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';

// App is a standalone component and is bootstrapped via `bootstrapApplication` in main.ts.
// Removing it from the NgModule bootstrap array avoids NG6009.
@NgModule({
  declarations: [],
  imports: [BrowserModule, AppRoutingModule]
})
export class AppModule {}
