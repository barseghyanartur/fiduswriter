# Generated by Django 2.1.7 on 2019-07-01 09:43
import os
from shutil import copyfile
from zipfile import ZipFile

from django.db import migrations
from django.core.files import File
from django.conf import settings


def find_file_path(file_path):
    zip = ZipFile(file_path, 'r')
    if len(zip.read('bibliography.json')) > 0:
        # bibliography is not broken, use this file
        return file_path
    path_parts = file_path.split('/')
    if len(path_parts) < 5 or path_parts[-5] != 'revision':
        # We could not find a working version
        return None
    file_datetime = zip.getinfo('mimetype').date_time
    path_parts.pop()
    path_parts.pop()
    path_parts.pop()
    dir_path = '/'.join(path_parts)
    for file in os.listdir(dir_path):
        file_path = os.path.join(dir_path, file)
        if not os.path.isfile(file_path):
            continue
        zip = ZipFile(file_path, 'r')
        if zip.getinfo('mimetype').date_time == file_datetime:
            return find_file_path(file_path)
    return None


def fix_document_revisions(apps, schema_editor):
    # Upgraded document revisions have been saved without bibliography and in
    # odd location in FW 3.5 + 3.6. Luckily previous versions of the revisions
    # have not been overwritten by newer versions so we switch to the older
    # versions in the revision folder and put them into the document-revisions
    # folder (new location).
    DocumentRevision = apps.get_model('document', 'DocumentRevision')
    revisions = DocumentRevision.objects.filter(
        file_object__contains='revision/'
    )
    for revision in revisions:
        old_path = find_file_path(revision.file_object.path)
        if not old_path:
            print(
                "Document revision {id} could not be fixed".format(
                    id=revision.pk
                )
            )
            continue
        # We create a backup just in case
        if not os.path.exists(
            os.path.join(
                settings.MEDIA_ROOT,
                "document-revisions-backup"
            )
        ):
            os.makedirs(
                os.path.join(
                    settings.MEDIA_ROOT,
                    "document-revisions-backup"
                )
            )
        copyfile(
            old_path,
            os.path.join(
                settings.MEDIA_ROOT,
                "document-revisions-backup/{id}.fidus".format(id=revision.pk)
            )
        )
        new_file = File(open(old_path, 'rb'))
        revision.file_object.save(
            "document-revisions/{id}.fidus".format(id=revision.pk),
            new_file
        )


class Migration(migrations.Migration):

    dependencies = [
        ('document', '0007_auto_20190227_2105'),
    ]

    operations = [
        migrations.RunPython(fix_document_revisions),
    ]
