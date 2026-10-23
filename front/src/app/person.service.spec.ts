import { TestBed } from '@angular/core/testing';

import { PersonService } from './person.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { API_BASE_URL } from './config';

describe('PersonService', () => {
  let service: PersonService;
  let http: HttpTestingController;

  const nextRequest = async (url: string) => {
    await new Promise(resolve => setTimeout(resolve));
    return http.expectOne(url);
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(PersonService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return the persons embedded in the API response', async () => {
    const result = service.fetchAll();
    (await nextRequest(`${API_BASE_URL}/persons`)).flush({
      _embedded: { persons: [{ id: 1, firstName: 'John' }] }
    });
    expect((await result).map(p => p.firstName)).toEqual(['John']);
  });

  it('should load the organizations of a person', async () => {
    const result = service.fetchById(1);
    (await nextRequest(`${API_BASE_URL}/persons/1`)).flush({ id: 1, firstName: 'John' });
    (await nextRequest(`${API_BASE_URL}/persons/1/organizations`)).flush({
      _embedded: { organizations: [{ id: 2, name: 'Orion' }] }
    });
    expect((await result).organizations[0].name).toEqual('Orion');
  });

  it('should create a person with a POST when it has no id', async () => {
    const result = service.save({ firstName: 'Jane', lastName: 'Roe' } as any);
    const request = await nextRequest(`${API_BASE_URL}/persons`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.firstName).toBe('Jane');
    request.flush({ id: 3, firstName: 'Jane' });
    (await nextRequest(`${API_BASE_URL}/persons/3/organizations`)).flush({ _embedded: { organizations: [] } });
    expect((await result).id).toBe(3);
  });

  it('should update a person with a PUT when it has an id', async () => {
    const result = service.save({ id: 3, firstName: 'Jane' } as any);
    const request = await nextRequest(`${API_BASE_URL}/persons/3`);
    expect(request.request.method).toBe('PUT');
    request.flush({ id: 3, firstName: 'Jane' });
    (await nextRequest(`${API_BASE_URL}/persons/3/organizations`)).flush({ _embedded: { organizations: [] } });
    await result;
  });

  it('should send a DELETE request when deleting a person', async () => {
    const result = service.deleteById(4);
    const request = await nextRequest(`${API_BASE_URL}/persons/4`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    await result;
  });
});
