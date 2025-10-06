import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PartialPickingComponent } from './partial-picking.component';
import { AuthService } from '../../../core/services/auth.service';

class MockAuthService {
  userDisplayName(): string {
    return 'Test Operator';
  }

  logout(): void {
    // noop for testing
  }
}

describe('PartialPickingComponent', () => {
  let fixture: ComponentFixture<PartialPickingComponent>;
  let component: PartialPickingComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PartialPickingComponent],
      providers: [
        { provide: AuthService, useClass: MockAuthService },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PartialPickingComponent);
    component = fixture.componentInstance;
  });

  it('should create and populate the form with mock data', fakeAsync(() => {
    fixture.detectChanges();
    tick(600); // advance timer to allow mock data to load

    expect(component).toBeTruthy();
    expect(component.partialPickingData().runNo).toBe('PR001-2025');
    expect(component.partialPickingForm.get('runNo')?.value).toBe('PR001-2025');
  }));
});
