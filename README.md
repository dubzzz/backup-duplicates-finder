# Find duplicates files in your backups before restoring them

> ⚠️ This project has been created in order to help me into gathering into a single directory all the backups I gathered over the years. It has not been done with strict coding guidelines: no tests, no clean error handling... As such if you consider using it in some ways, please make sure to understand what it does and be sure it will not be harmful in any ways for you.
>
> It should only traverses your file system starting from some entry-points and read the files into it to extract their sha1. Once done, it saves the results into a `.cache/` directory.

## Story of the project

Before cloud providers become a thing I used to manually backup my data in various places: locally on the same machine, on another machine, on an USB stick, an external hard drive or a CD... The aim was not to lose data. Unfortunately the data gets quickly spread over many places and even if never lost, it was hard to find it back.

When cloud providers and drive solutions came up, I started to look for a secure and privacy aware one. I finally found one some years ago thanks to Proton Drive. Now I have a safe drive, I wanted to stop having these manual backups and re-merge them all together into it.

## The challenge

While my backups have been taken at various points in time, they may contain diverging data. At some points, I experienced data loss and these old backups contain both data I explicitely deleted, data I did not copied in all places and data I lost. As such I cannot just delete them because I have a more recent backup.

As such I created this script. I takes an old backup — refered as _copy_ in the code — that is theorically outdated and checks if it does not contain anything that could be useful against a fresher version — refered as _source_ in the code.

## Using it

```sh
# Not ready yet
```
