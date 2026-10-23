import { TestBed } from '@angular/core/testing';

import { OrganizationService } from './organization.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { API_BASE_URL } from './config';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let http: HttpTestingController;

  const nextRequest = async (url: string) => {
    await new Promise(resolve => setTimeout(resolve));
    return http.expectOne(url);
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(OrganizationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return the organizations embedded in the API response', async () => {
    const result = service.fetchAll();
    (await nextRequest(`${API_BASE_URL}/organizations`)).flush({
      _embedded: { organizations: [{ id: 1, name: 'Orion' }] }
    });
    expect((await result).map(o => o.name)).toEqual(['Orion']);
  });

  it('should load the persons of an organization', async () => {
    const result = service.fetchById(1);
    (await nextRequest(`${API_BASE_URL}/organizations/1`)).flush({ id: 1, name: 'Orion' });
    (await nextRequest(`${API_BASE_URL}/organizations/1/persons`)).flush({
      _embedded: { persons: [{ id: 2, firstName: 'John' }] }
    });
    expect((await result).persons[0].firstName).toEqual('John');
  });

  it('should link a person to an organization with a uri-list PUT', async () => {
    const result = service.addPerson(1, 2);
    const request = await nextRequest(`${API_BASE_URL}/organizations/1/persons`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toBe(`${API_BASE_URL}/persons/2`);
    expect(request.request.headers.get('Content-Type')).toBe('text/uri-list');
    request.flush(null);
    await result;
  });

  it('should unlink a person from an organization with a DELETE', async () => {
    const result = service.removePerson(1, 2);
    const request = await nextRequest(`${API_BASE_URL}/persons/2/organizations/1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
    await result;
  });
});
