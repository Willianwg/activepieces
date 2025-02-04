import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CollectionService } from '../../../common/service/collection.service';
import { map, Observable, startWith, Subject, switchMap, tap } from 'rxjs';
import { CollectionsTableDataSource } from './collections-table.datasource';
import { MatDialog } from '@angular/material/dialog';
import { ARE_THERE_COLLECTIONS_FLAG } from '../../dashboard.routing';
import {
  Collection,
  CollectionListDto,
  CollectionStatus,
  Flow,
  InstanceStatus,
} from '@activepieces/shared';
import {
  DeleteEntityDialogComponent,
  DeleteEntityDialogData,
} from '../../components/delete-enity-dialog/delete-collection-dialog.component';
import { ApPaginatorComponent } from '../../../common/components/pagination/ap-paginator.component';
import { ProjectService } from '../../../common/service/project.service';
import { FlowService } from '../../../common/service/flow.service';
import { DEFAULT_PAGE_SIZE } from '../../../common/components/pagination/tables.utils';
import { FormControl } from '@angular/forms';
import { InstanceService } from '../../../common/service/instance.service';
@Component({
  templateUrl: './collections-table.component.html',
})
export class CollectionsTableComponent implements OnInit {
  @ViewChild(ApPaginatorComponent, { static: true })
  paginator!: ApPaginatorComponent;
  creatingCollection = false;
  archiveCollectionDialogClosed$: Observable<void>;
  createCollection$: Observable<Flow>;
  dataSource!: CollectionsTableDataSource;
  displayedColumns = ['name', 'created', 'status', 'action'];
  collectionDeleted$: Subject<boolean> = new Subject();
  areThereCollections$: Observable<boolean>;
  collectionsUpdateStatusRequest$: Record<string, Observable<void> | null> = {};
  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private collectionService: CollectionService,
    private dialogService: MatDialog,
    private projectService: ProjectService,
    private flowService: FlowService,
    private instanceService: InstanceService
  ) {}

  ngOnInit(): void {
    this.dataSource = new CollectionsTableDataSource(
      this.activatedRoute.queryParams.pipe(
        map((res) => res['limit'] || DEFAULT_PAGE_SIZE)
      ),
      this.activatedRoute.queryParams.pipe(map((res) => res['cursor'])),
      this.paginator,
      this.projectService,
      this.collectionService,
      this.collectionDeleted$.asObservable().pipe(startWith(true))
    );
    this.areThereCollections$ = this.activatedRoute.data.pipe(
      map((res) => {
        return res[ARE_THERE_COLLECTIONS_FLAG];
      })
    );
  }

  openBuilder(collection: Collection) {
    const link = '/flows/' + collection.id;
    this.router.navigate([link]);
  }

  deleteCollection(collection: Collection) {
    const dialogRef = this.dialogService.open(DeleteEntityDialogComponent, {
      data: {
        deleteEntity$: this.collectionService.delete(collection.id),
        entityName: collection.displayName,
      } as DeleteEntityDialogData,
    });
    this.archiveCollectionDialogClosed$ = dialogRef.beforeClosed().pipe(
      tap((res) => {
        if (res) {
          this.collectionDeleted$.next(true);
        }
      }),
      map(() => {
        return void 0;
      })
    );
  }

  createCollection() {
    if (!this.creatingCollection) {
      this.creatingCollection = true;
      const collectionDiplayName = 'Untitled';
      this.createCollection$ = this.collectionService
        .create({
          displayName: collectionDiplayName,
        })
        .pipe(
          switchMap((collection) => {
            return this.flowService.create({
              collectionId: collection.id,
              displayName: 'Flow 1',
            });
          }),
          tap((flow) => {
            this.router.navigate(['/flows/', flow.collectionId], {
              queryParams: { newCollection: true },
            });
          })
        );
    }
  }
  toggleCollectionStatus(
    collectionDto: CollectionListDto,
    control: FormControl<boolean>
  ) {
    control.disable();
    this.collectionsUpdateStatusRequest$[collectionDto.id] =
      this.instanceService
        .updateStatus(collectionDto.id, {
          status:
            collectionDto.status === CollectionStatus.ENABLED
              ? InstanceStatus.DISABLED
              : InstanceStatus.ENABLED,
        })
        .pipe(
          tap((res) => {
            control.enable();
            control.setValue(res.status === InstanceStatus.ENABLED);
            this.collectionsUpdateStatusRequest$[collectionDto.id] = null;
            collectionDto.status =
              res.status === InstanceStatus.ENABLED
                ? CollectionStatus.ENABLED
                : CollectionStatus.DISABLED;
          }),
          map(() => void 0)
        );
  }
}
